-- 003_category_rules_seed.sql
-- Ampliwork Financial Dashboard - Default Categorization Rules
--
-- These rules use a placeholder org_id ('00000000-0000-0000-0000-000000000000').
-- During onboarding, copy these rows with the real org_id or update in place.

DO $$
DECLARE
    placeholder_org UUID := '00000000-0000-0000-0000-000000000000';
BEGIN

-- First ensure the placeholder org exists so the FK is satisfied
INSERT INTO organizations (id, name)
VALUES (placeholder_org, '__default_rules_template')
ON CONFLICT (id) DO NOTHING;

INSERT INTO category_rules
    (org_id, rule_name, rule_type, match_field, match_value, target_category, target_department, priority)
VALUES
    -- Cloud / Infrastructure  (Engineering)
    (placeholder_org, 'AWS',            'contains', 'vendor', 'AWS',            'Tools & Software', 'Engineering', 10),
    (placeholder_org, 'Amazon Web Services', 'contains', 'vendor', 'Amazon Web Services', 'Tools & Software', 'Engineering', 11),
    (placeholder_org, 'Google Cloud',   'contains', 'vendor', 'Google Cloud',   'Tools & Software', 'Engineering', 12),
    (placeholder_org, 'Azure',          'contains', 'vendor', 'Azure',          'Tools & Software', 'Engineering', 13),

    -- Design tools (Product)
    (placeholder_org, 'Figma',          'contains', 'vendor', 'Figma',          'Tools & Software', 'Product',     20),
    (placeholder_org, 'Miro',           'contains', 'vendor', 'Miro',           'Tools & Software', 'Product',     21),

    -- Collaboration / Operations
    (placeholder_org, 'Slack',          'contains', 'vendor', 'Slack',          'Tools & Software', 'Operations',  30),
    (placeholder_org, 'Notion',         'contains', 'vendor', 'Notion',         'Tools & Software', 'Operations',  31),
    (placeholder_org, 'Zoom',           'contains', 'vendor', 'Zoom',           'Tools & Software', 'Operations',  32),

    -- Marketing tools
    (placeholder_org, 'HubSpot',        'contains', 'vendor', 'HubSpot',        'Tools & Software', 'Marketing',   40),

    -- Sales tools
    (placeholder_org, 'Salesforce',     'contains', 'vendor', 'Salesforce',     'Tools & Software', 'Sales',       50),

    -- Advertising / Marketing spend
    (placeholder_org, 'Google Ads',     'contains', 'vendor', 'Google Ads',     'Marketing',        'Marketing',   60),
    (placeholder_org, 'Meta Ads',       'contains', 'vendor', 'Meta Ads',       'Marketing',        'Marketing',   61),
    (placeholder_org, 'Facebook Ads',   'contains', 'vendor', 'Facebook Ads',   'Marketing',        'Marketing',   62),
    (placeholder_org, 'LinkedIn',       'contains', 'vendor', 'LinkedIn',       'Marketing',        'Marketing',   63),

    -- Payroll providers
    (placeholder_org, 'ADP',            'contains', 'vendor', 'ADP',            'Payroll',          NULL,          70),
    (placeholder_org, 'Gusto',          'contains', 'vendor', 'Gusto',          'Payroll',          NULL,          71),
    (placeholder_org, 'Rippling',       'contains', 'vendor', 'Rippling',       'Payroll',          NULL,          72),

    -- Office / Facilities
    (placeholder_org, 'WeWork',         'contains', 'vendor', 'WeWork',         'Opex',             'Operations',  80),
    (placeholder_org, 'Regus',          'contains', 'vendor', 'Regus',          'Opex',             'Operations',  81),

    -- Developer tooling (Engineering)
    (placeholder_org, 'GitHub',         'contains', 'vendor', 'GitHub',         'Tools & Software', 'Engineering', 90),
    (placeholder_org, 'Vercel',         'contains', 'vendor', 'Vercel',         'Tools & Software', 'Engineering', 91),
    (placeholder_org, 'Netlify',        'contains', 'vendor', 'Netlify',        'Tools & Software', 'Engineering', 92);

END $$;
