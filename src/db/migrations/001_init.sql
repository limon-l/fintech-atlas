-- ATLAS sandbox schema. All monetary columns are integer minor units.
-- Posted ledger records are immutable; corrections use compensating journals.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  platform_role TEXT NOT NULL DEFAULT 'customer'
    CHECK (platform_role IN ('customer','support','risk','compliance','admin','super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  kyc_status TEXT NOT NULL DEFAULT 'verified'
    CHECK (kyc_status IN ('unverified','pending','verified','rejected')),
  country TEXT NOT NULL DEFAULT 'GB',
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  revoked_at TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  legal_name TEXT,
  country TEXT NOT NULL DEFAULT 'GB',
  base_currency TEXT NOT NULL DEFAULT 'USD',
  kyb_status TEXT NOT NULL DEFAULT 'verified'
    CHECK (kyb_status IN ('unverified','pending','verified','rejected')),
  created_at TEXT NOT NULL
);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','finance_manager','approver','employee')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended')),
  created_at TEXT NOT NULL,
  UNIQUE (org_id, user_id)
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user','org')),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('checking','savings','wallet','treasury','goal')),
  currency TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'GB',
  iban TEXT,
  account_number_masked TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX accounts_owner ON accounts(owner_type, owner_id);

CREATE TABLE ledger_accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  currency TEXT NOT NULL,
  account_id TEXT REFERENCES accounts(id),
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX ledger_accounts_account ON ledger_accounts(account_id);

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('transfer','deposit','fx','fee','invoice','reversal','card','goal','adjustment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','reversed')),
  transfer_id TEXT,
  invoice_id TEXT,
  reversal_of TEXT REFERENCES journal_entries(id),
  actor_id TEXT,
  created_at TEXT NOT NULL,
  posted_at TEXT
);
CREATE INDEX journal_entries_created ON journal_entries(created_at);
CREATE INDEX journal_entries_transfer ON journal_entries(transfer_id);

CREATE TABLE postings (
  id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL REFERENCES journal_entries(id),
  ledger_account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
  currency TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor <> 0),
  created_at TEXT NOT NULL
);
CREATE INDEX postings_ledger ON postings(ledger_account_id);
CREATE INDEX postings_journal ON postings(journal_id);

-- Financial immutability and balance enforcement at the database layer.
CREATE TRIGGER postings_no_update BEFORE UPDATE ON postings
BEGIN
  SELECT RAISE(ABORT, 'posted ledger postings are immutable');
END;

CREATE TRIGGER postings_no_delete BEFORE DELETE ON postings
BEGIN
  SELECT RAISE(ABORT, 'posted ledger postings are immutable');
END;

CREATE TRIGGER posting_currency_check BEFORE INSERT ON postings
WHEN (SELECT currency FROM ledger_accounts WHERE id = NEW.ledger_account_id) <> NEW.currency
BEGIN
  SELECT RAISE(ABORT, 'posting currency must match ledger account currency');
END;

CREATE TRIGGER journal_no_delete BEFORE DELETE ON journal_entries
BEGIN
  SELECT RAISE(ABORT, 'journal entries are immutable');
END;

CREATE TRIGGER journal_immutable BEFORE UPDATE ON journal_entries
WHEN OLD.status <> 'pending'
BEGIN
  SELECT RAISE(ABORT, 'journal entry is already final');
END;

CREATE TRIGGER journal_balance_check AFTER UPDATE OF status ON journal_entries
WHEN NEW.status = 'posted'
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT currency FROM postings
    WHERE journal_id = NEW.id
    GROUP BY currency
    HAVING SUM(amount_minor) <> 0
  ) THEN RAISE(ABORT, 'unbalanced journal entry') END;
  SELECT CASE WHEN (SELECT COUNT(*) FROM postings WHERE journal_id = NEW.id) < 2
    THEN RAISE(ABORT, 'journal entry requires at least two postings') END;
END;

CREATE TABLE holds (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','captured','released','expired')),
  transfer_id TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX holds_active ON holds(account_id, status);

CREATE TABLE beneficiaries (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user','org')),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank','wallet','internal')),
  email TEXT,
  bank_name TEXT,
  account_masked TEXT,
  iban_masked TEXT,
  linked_account_id TEXT REFERENCES accounts(id),
  currency TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'GB',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TEXT NOT NULL
);
CREATE INDEX beneficiaries_owner ON beneficiaries(owner_type, owner_id);

CREATE TABLE fx_quotes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate TEXT NOT NULL,
  source_amount_minor INTEGER NOT NULL CHECK (source_amount_minor > 0),
  target_amount_minor INTEGER NOT NULL CHECK (target_amount_minor > 0),
  fee_minor INTEGER NOT NULL DEFAULT 0,
  fee_currency TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired')),
  created_at TEXT NOT NULL
);

CREATE TABLE transfers (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  source_account_id TEXT NOT NULL REFERENCES accounts(id),
  beneficiary_id TEXT REFERENCES beneficiaries(id),
  destination_account_id TEXT REFERENCES accounts(id),
  direction TEXT NOT NULL CHECK (direction IN ('internal','external','fx','goal')),
  status TEXT NOT NULL CHECK (
    status IN ('pending_authorization','authorized','processing','posted','failed','canceled','reversed')
  ),
  source_amount_minor INTEGER NOT NULL CHECK (source_amount_minor > 0),
  source_currency TEXT NOT NULL,
  target_amount_minor INTEGER,
  target_currency TEXT,
  fee_minor INTEGER NOT NULL DEFAULT 0,
  fee_currency TEXT,
  rate TEXT,
  quote_id TEXT REFERENCES fx_quotes(id),
  hold_id TEXT REFERENCES holds(id),
  journal_id TEXT REFERENCES journal_entries(id),
  provider_ref TEXT,
  failure_reason TEXT,
  note TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  settled_at TEXT
);
CREATE INDEX transfers_user ON transfers(user_id, created_at);
CREATE INDEX transfers_status ON transfers(status);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  journal_id TEXT REFERENCES journal_entries(id),
  transfer_id TEXT REFERENCES transfers(id),
  card_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('draft','pending','authorized','processing','posted','failed','canceled','reversed')
  ),
  category TEXT NOT NULL,
  merchant TEXT,
  description TEXT NOT NULL,
  counterparty TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX transactions_account ON transactions(account_id, occurred_at);
CREATE INDEX transactions_category ON transactions(category);
CREATE INDEX transactions_transfer ON transactions(transfer_id);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user','org')),
  owner_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  label TEXT NOT NULL,
  last4 TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'VISA',
  kind TEXT NOT NULL DEFAULT 'virtual' CHECK (kind IN ('virtual','physical')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','canceled')),
  monthly_limit_minor INTEGER NOT NULL,
  per_txn_limit_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  allowed_categories TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  frozen_at TEXT
);
CREATE INDEX cards_owner ON cards(owner_type, owner_id);

CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  month TEXT NOT NULL,
  total_limit_minor INTEGER NOT NULL CHECK (total_limit_minor > 0),
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, month)
);

CREATE TABLE budget_categories (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  limit_minor INTEGER NOT NULL CHECK (limit_minor >= 0),
  UNIQUE (budget_id, category)
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  target_minor INTEGER NOT NULL CHECK (target_minor > 0),
  currency TEXT NOT NULL,
  target_date TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  created_at TEXT NOT NULL
);

CREATE TABLE goal_contributions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  transfer_id TEXT REFERENCES transfers(id),
  created_at TEXT NOT NULL
);

CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  email TEXT,
  category TEXT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TEXT NOT NULL
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  email TEXT,
  country TEXT NOT NULL DEFAULT 'GB',
  created_at TEXT NOT NULL
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  number TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL CHECK (status IN ('draft','sent','partially_paid','paid','void')),
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  currency TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL,
  tax_minor INTEGER NOT NULL,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL,
  amount_paid_minor INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (org_id, number)
);

CREATE TABLE invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  description TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0)
);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','awaiting_approval','approved','scheduled','paid','overdue','void')),
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (org_id, number)
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','pending','approved','rejected','reimbursed')),
  project TEXT,
  receipt_name TEXT,
  submitted_at TEXT NOT NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE approval_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL CHECK (type IN ('expense','bill','invoice','payment')),
  resource_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','canceled')),
  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 2,
  requested_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX approvals_org ON approval_requests(org_id, status);

CREATE TABLE approval_steps (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL,
  role_required TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','skipped')),
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT,
  comment TEXT,
  UNIQUE (request_id, step_no)
);

CREATE TABLE spending_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  monthly_limit_minor INTEGER NOT NULL,
  per_txn_limit_minor INTEGER NOT NULL,
  requires_receipt INTEGER NOT NULL DEFAULT 1,
  categories TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE risk_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  org_id TEXT REFERENCES organizations(id),
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','cleared','escalated')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  transfer_id TEXT REFERENCES transfers(id),
  assigned_to TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX risk_status ON risk_events(status, severity);

CREATE TABLE compliance_cases (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user','org')),
  subject_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('kyc','kyb','aml','dispute')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','info_requested','approved','rejected')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  summary TEXT NOT NULL,
  assigned_to TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE provider_events (
  id TEXT PRIMARY KEY,
  transfer_id TEXT REFERENCES transfers(id),
  provider_ref TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received','processing','settled','failed')),
  created_at TEXT NOT NULL
);
CREATE INDEX provider_events_transfer ON provider_events(transfer_id);

CREATE TABLE reconciliation_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  item_count INTEGER NOT NULL DEFAULT 0,
  exception_count INTEGER NOT NULL DEFAULT 0,
  actor_id TEXT
);

CREATE TABLE reconciliation_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES reconciliation_runs(id),
  currency TEXT NOT NULL,
  ledger_minor INTEGER NOT NULL,
  provider_minor INTEGER NOT NULL,
  difference_minor INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('matched','exception','investigating','resolved')),
  transfer_id TEXT REFERENCES transfers(id),
  note TEXT
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  href TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX notifications_user ON notifications(user_id, created_at);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  org_id TEXT,
  ip TEXT,
  request_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX audit_created ON audit_events(created_at);

CREATE TABLE idempotency_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, scope, key)
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('delivered','failed','pending')),
  attempts INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  assignee_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
