-- PostgreSQL initialization script for ERP system
-- This script sets up the database with required extensions and initial schema

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "hstore";
CREATE EXTENSION IF NOT EXISTS "jsonb";

-- Set default schema search path
SET search_path TO public;

-- Create a comment describing the database
COMMENT ON DATABASE erp_db IS 'Lancer ERP - Enterprise Resource Planning System';

-- Create audit schema for logging
CREATE SCHEMA IF NOT EXISTS audit;
GRANT USAGE ON SCHEMA audit TO public;
GRANT CREATE ON SCHEMA audit TO public;

-- Create enumeration types
CREATE TYPE user_role AS ENUM (
    'super_admin',
    'admin',
    'manager',
    'supervisor',
    'user'
);

CREATE TYPE transaction_status AS ENUM (
    'draft',
    'pending',
    'approved',
    'rejected',
    'completed',
    'cancelled'
);

CREATE TYPE document_type AS ENUM (
    'po',
    'pr',
    'grir',
    'grn',
    'dn',
    'payment',
    'invoice',
    'receipt',
    'journal'
);

-- Create base audit table for all auditable tables
CREATE TABLE IF NOT EXISTS audit.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(255) NOT NULL,
    record_id UUID,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    changed_by UUID,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_operation CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- Create index on audit log
CREATE INDEX idx_audit_log_table_name ON audit.audit_log(table_name);
CREATE INDEX idx_audit_log_record_id ON audit.audit_log(record_id);
CREATE INDEX idx_audit_log_changed_at ON audit.audit_log(changed_at DESC);
CREATE INDEX idx_audit_log_changed_by ON audit.audit_log(changed_by);

-- Create function to log changes
CREATE OR REPLACE FUNCTION audit.log_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_old_values JSONB := NULL;
    v_new_values JSONB := NULL;
    v_changed_by UUID := NULL;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_old_values := row_to_json(OLD);
        INSERT INTO audit.audit_log (
            table_name, record_id, operation, changed_by, old_values
        ) VALUES (
            TG_TABLE_NAME, OLD.id, 'DELETE', v_changed_by, v_old_values
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_values := row_to_json(OLD);
        v_new_values := row_to_json(NEW);
        INSERT INTO audit.audit_log (
            table_name, record_id, operation, changed_by, old_values, new_values
        ) VALUES (
            TG_TABLE_NAME, NEW.id, 'UPDATE', v_changed_by, v_old_values, v_new_values
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        v_new_values := row_to_json(NEW);
        INSERT INTO audit.audit_log (
            table_name, record_id, operation, changed_by, new_values
        ) VALUES (
            TG_TABLE_NAME, NEW.id, 'INSERT', v_changed_by, v_new_values
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for common queries
CREATE INDEX idx_created_at ON public.created_at DESC;
CREATE INDEX idx_updated_at ON public.updated_at DESC;

-- Create function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create role for application
CREATE ROLE erp_app WITH LOGIN;
GRANT CONNECT ON DATABASE erp_db TO erp_app;
GRANT USAGE ON SCHEMA public TO erp_app;
GRANT USAGE ON SCHEMA audit TO erp_app;
GRANT CREATE ON SCHEMA public TO erp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO erp_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO erp_app;

-- Create role for read-only access (reports, analytics)
CREATE ROLE erp_readonly WITH LOGIN;
GRANT CONNECT ON DATABASE erp_db TO erp_readonly;
GRANT USAGE ON SCHEMA public TO erp_readonly;
GRANT USAGE ON SCHEMA audit TO erp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO erp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA audit TO erp_readonly;

-- Create role for backup user
CREATE ROLE erp_backup WITH LOGIN;
GRANT CONNECT ON DATABASE erp_db TO erp_backup;
GRANT pg_dump ON DATABASE erp_db TO erp_backup;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO erp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO erp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO erp_app;

-- Create materialized views schema
CREATE SCHEMA IF NOT EXISTS materialized_views;
GRANT USAGE ON SCHEMA materialized_views TO public;

-- Create partitioning for large tables (templates)
-- Note: These will be implemented in Django migrations
-- This is a placeholder for future implementation

-- Create settings table for system configuration
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    data_type VARCHAR(50),
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_settings_key ON system_settings(key);

-- Create cache table (optional, for session backend)
CREATE TABLE IF NOT EXISTS cache_table (
    cache_key VARCHAR(300) PRIMARY KEY,
    cache_value TEXT,
    cache_timeout TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_cache_timeout ON cache_table(cache_timeout);

-- Create initial system settings
INSERT INTO system_settings (key, value, data_type, description) VALUES
    ('company_name', 'Lancer ERP', 'string', 'Company name'),
    ('financial_year_start', '04-01', 'date_format', 'Financial year start (MM-DD)'),
    ('financial_year_end', '03-31', 'date_format', 'Financial year end (MM-DD)'),
    ('timezone', 'UTC', 'string', 'System timezone'),
    ('locale', 'en-US', 'string', 'System locale'),
    ('currency', 'USD', 'string', 'Default currency'),
    ('decimal_places', '2', 'integer', 'Default decimal places for amounts'),
    ('enable_audit_log', 'true', 'boolean', 'Enable audit logging'),
    ('retention_days', '365', 'integer', 'Number of days to retain audit logs')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions on system_settings
GRANT SELECT, INSERT, UPDATE, DELETE ON system_settings TO erp_app;
GRANT SELECT ON system_settings TO erp_readonly;

-- Analyze the database for query planning
ANALYZE;

-- Final comments
COMMENT ON SCHEMA audit IS 'Schema for audit logging and change tracking';
COMMENT ON SCHEMA materialized_views IS 'Schema for materialized views used in reporting and analytics';
COMMENT ON TABLE audit.audit_log IS 'Central audit log table tracking all data changes';
COMMENT ON TABLE system_settings IS 'System-wide configuration and settings';
