-- DevOps Platform Database Initialization
-- This script runs when the PostgreSQL container starts for the first time

-- Create additional databases if needed
-- The main database 'devops_platform' is created automatically

-- Set timezone
SET timezone = 'UTC';

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE '✅ DevOps Platform database initialized successfully!';
    RAISE NOTICE '📊 Database: devops_platform';
    RAISE NOTICE '👤 User: postgres';
    RAISE NOTICE '🌍 Timezone: UTC';
END $$;