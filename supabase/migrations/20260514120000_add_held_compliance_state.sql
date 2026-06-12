-- Post publish held until Content Cop approves (or override).
ALTER TYPE "State" ADD VALUE IF NOT EXISTS 'HELD_COMPLIANCE';
