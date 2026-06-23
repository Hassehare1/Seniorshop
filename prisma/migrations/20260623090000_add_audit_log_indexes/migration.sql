-- Index för AuditLog: login-spärren räknar LOGIN_FAILED per e-post i ett tidsfönster,
-- och admin-loggvyn hämtar senaste N sorterat på tid. Utan index → full table scan
-- som blir långsammare ju mer loggen växer.
CREATE INDEX "AuditLog_userEmail_action_createdAt_idx" ON "AuditLog"("userEmail", "action", "createdAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
