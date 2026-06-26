-- Migration 026: Add status column to cronograma table

ALTER TABLE cronograma ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'agendado';
-- status: agendado, concluido, cancelado
