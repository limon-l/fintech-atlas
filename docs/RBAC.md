# RBAC matrix

## Enforcement model

Permissions are explicit strings checked on the server. The UI hides some actions, but hiding is never the control. Services re-check permissions before writing.

Two scopes exist:

- **Platform** — staff roles for operations and support.
- **Organization** — business workspace roles tied to an active membership.

Ownership is checked separately. A permission never grants access to another customer's accounts or another organization's records.

## Platform roles

| Role | Permissions | Notes |
|---|---|---|
| `customer` | none | Personal workspace only; cannot access `/ops` |
| `support` | `ops:read`, `audit:read` | Read customer/support records; update support tickets |
| `risk` | `ops:read`, `ops:risk`, `audit:read`, `report:read` | Record risk decisions |
| `compliance` | `ops:read`, `ops:compliance`, `audit:read`, `report:read` | Record compliance decisions |
| `admin` | `ops:read`, `ops:reconcile`, `ops:ledger`, `ops:admin`, `audit:read`, `dev:manage` | Reconciliation, ledger corrections, integrations |
| `super_admin` | all platform permissions | Full operations surface |

Platform staff are never granted customer fund-movement authority. `canMoveCustomerFunds` returns true only for `customer`.

## Organization roles

| Role | Permissions |
|---|---|
| `owner` | account read/transfer/manage, card read/control, invoice read/write/send, expense submit/read/approve, bill read/write/approve/pay, approval read/decide, report read, team manage, org manage, dev manage, audit read |
| `finance_manager` | account read/transfer, card read/control, invoice read/write/send, expense submit/read/approve, bill read/write/approve/pay, approval read/decide, report read, audit read |
| `approver` | account read, card read, invoice read, expense submit/read, bill read, approval read/decide, report read |
| `employee` | account read, card read, expense submit, invoice read |

## Operation matrix

| Operation | Permission | Additional checks |
|---|---|---|
| View personal accounts | session + ownership | account belongs to user |
| Submit internal transfer | `account:transfer` | PIN, funds, idempotency, active accounts |
| Submit external payout | `account:transfer` | PIN, funds, hold, beneficiary ownership |
| Convert FX | `account:transfer` | PIN, valid unexpired quote, own wallets only |
| Create invoice | `invoice:write` | active organization membership |
| Send invoice | `invoice:send` | organization ownership |
| Record invoice payment | `invoice:write` | organization ownership, account ownership |
| Create bill | `bill:write` | organization ownership |
| Pay bill | `bill:pay` | approved bill, organization account, funds |
| Submit expense | `expense:submit` | organization membership |
| Reimburse expense | `expense:approve` | approved expense, organization account |
| Decide approval | `approval:decide` | current step role, maker-checker, PIN |
| Manage team | `team:manage` | organization ownership |
| Review risk | `ops:risk` | note, PIN |
| Review compliance | `ops:compliance` | note, PIN |
| Run reconciliation | `ops:reconcile` | audit event |
| Resolve reconciliation item | `ops:reconcile` | note, PIN |
| Reverse journal | `ops:ledger` | reason, PIN |
| Post adjustment | `ops:ledger` | currency match, funds, reason, PIN |
| Replay webhook | `dev:manage` or `ops:admin` | audit event |
| Create API key | `dev:manage` or active org owner/finance manager | hashed key, prefix |
| View audit | `audit:read` | read-only |

## Maker-checker

Business approvals use ordered steps. The seeded bill flow requires:

1. `approver`
2. `finance_manager`

The requester cannot decide their own request, even if their role matches the current step. An owner may act on the finance-manager step, but still cannot self-approve. Every decision requires the authorization PIN and writes an audit event.

## Step-up PIN

Sensitive actions verify a hashed PIN with rate limiting. The demo PIN is `246810`. This is a demonstration control, not a production second factor. A real system would use WebAuthn, TOTP or a signed approval channel.

## API keys

Bearer keys are stored as SHA-256 hashes with a visible prefix. They are sandbox-only, read-only and owner-scoped. Revocation is immediate. There is no HTTP endpoint that moves money.

## Session controls

- Opaque random session token.
- HttpOnly, SameSite=Lax cookie.
- Eight-hour expiry.
- Hashed token at rest.
- Sign-out revokes the session.
- Login and PIN attempts are rate-limited in process memory.

## Non-claims

- No independent security review or penetration test.
- No production identity provider, SSO or MFA.
- Rate limiting is process-local.
- Broad synthetic staff visibility exists by design for demonstration.
- The permission matrix is not a regulatory certification.
