-- Journals must enter through pending, then pass the balance trigger.
CREATE TRIGGER journal_insert_pending BEFORE INSERT ON journal_entries
WHEN NEW.status <> 'pending'
BEGIN
  SELECT RAISE(ABORT, 'journals must be created pending');
END;

CREATE TRIGGER posting_final_journal BEFORE INSERT ON postings
WHEN (SELECT status FROM journal_entries WHERE id = NEW.journal_id) <> 'pending'
BEGIN
  SELECT RAISE(ABORT, 'cannot append to a final journal');
END;

CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are immutable');
END;

CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are immutable');
END;
