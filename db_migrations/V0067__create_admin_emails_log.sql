CREATE TABLE IF NOT EXISTS t_p29007832_virtual_fitting_room.admin_emails_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    to_email TEXT NOT NULL,
    to_name TEXT,
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    error_message TEXT,
    sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_emails_log_user_id ON t_p29007832_virtual_fitting_room.admin_emails_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_emails_log_sent_at ON t_p29007832_virtual_fitting_room.admin_emails_log(sent_at DESC);