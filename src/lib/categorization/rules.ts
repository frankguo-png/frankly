export const DEFAULT_RULES = [
  // Revenue
  { rule_name: 'LNER Revenue', rule_type: 'contains', match_field: 'vendor', match_value: 'LNER', target_category: 'Revenue', target_project: 'LNER', priority: 10 },
  { rule_name: 'PWC Revenue', rule_type: 'contains', match_field: 'vendor', match_value: 'PWC', target_category: 'Revenue', target_project: 'PWC', priority: 11 },
  { rule_name: 'IWAKI Revenue', rule_type: 'contains', match_field: 'vendor', match_value: 'IWAKI', target_category: 'Revenue', target_project: 'IWAKI', priority: 12 },
  { rule_name: 'Brookfield Revenue', rule_type: 'contains', match_field: 'vendor', match_value: 'Brookfield', target_category: 'Revenue', target_project: 'Brookfield', priority: 13 },

  // Tools & Software
  { rule_name: 'AWS', rule_type: 'contains', match_field: 'vendor', match_value: 'AWS', target_category: 'Tools & Software', target_department: 'Engineering', priority: 20 },
  { rule_name: 'Google Cloud', rule_type: 'contains', match_field: 'vendor', match_value: 'Google Cloud', target_category: 'Tools & Software', target_department: 'Engineering', priority: 21 },
  { rule_name: 'Vercel', rule_type: 'contains', match_field: 'vendor', match_value: 'Vercel', target_category: 'Tools & Software', target_department: 'Engineering', priority: 22 },
  { rule_name: 'GitHub', rule_type: 'contains', match_field: 'vendor', match_value: 'GitHub', target_category: 'Tools & Software', target_department: 'Engineering', priority: 23 },
  { rule_name: 'Figma', rule_type: 'contains', match_field: 'vendor', match_value: 'Figma', target_category: 'Tools & Software', target_department: 'Product', priority: 24 },
  { rule_name: 'Slack', rule_type: 'contains', match_field: 'vendor', match_value: 'Slack', target_category: 'Tools & Software', target_department: 'Operations', priority: 25 },
  { rule_name: 'Notion', rule_type: 'contains', match_field: 'vendor', match_value: 'Notion', target_category: 'Tools & Software', target_department: 'Operations', priority: 26 },
  { rule_name: 'Zoom', rule_type: 'contains', match_field: 'vendor', match_value: 'Zoom', target_category: 'Tools & Software', target_department: 'Operations', priority: 27 },
  { rule_name: 'HubSpot', rule_type: 'contains', match_field: 'vendor', match_value: 'HubSpot', target_category: 'Tools & Software', target_department: 'Marketing', priority: 28 },
  { rule_name: 'Salesforce', rule_type: 'contains', match_field: 'vendor', match_value: 'Salesforce', target_category: 'Tools & Software', target_department: 'Sales', priority: 29 },

  // Marketing
  { rule_name: 'Google Ads', rule_type: 'contains', match_field: 'vendor', match_value: 'Google Ads', target_category: 'Marketing', target_department: 'Marketing', priority: 30 },
  { rule_name: 'Meta Ads', rule_type: 'contains', match_field: 'vendor', match_value: 'Meta', target_category: 'Marketing', target_department: 'Marketing', priority: 31 },
  { rule_name: 'LinkedIn Ads', rule_type: 'contains', match_field: 'vendor', match_value: 'LinkedIn', target_category: 'Marketing', target_department: 'Marketing', priority: 32 },

  // Payroll
  { rule_name: 'Payroll - Rippling', rule_type: 'contains', match_field: 'vendor', match_value: 'Rippling', target_category: 'Payroll', priority: 40 },
  { rule_name: 'Payroll - ADP', rule_type: 'contains', match_field: 'vendor', match_value: 'ADP', target_category: 'Payroll', priority: 41 },
  { rule_name: 'Payroll keyword', rule_type: 'contains', match_field: 'description', match_value: 'payroll', target_category: 'Payroll', priority: 42 },

  // Infrastructure / Office
  { rule_name: 'WeWork', rule_type: 'contains', match_field: 'vendor', match_value: 'WeWork', target_category: 'Infrastructure', target_department: 'Operations', priority: 50 },
  { rule_name: 'Office Rent', rule_type: 'contains', match_field: 'description', match_value: 'rent', target_category: 'Infrastructure', target_department: 'Operations', priority: 51 },

  // Legal & Admin
  { rule_name: 'Legal', rule_type: 'contains', match_field: 'vendor', match_value: 'Legal', target_category: 'Legal & Admin', target_department: 'Admin', priority: 60 },
  { rule_name: 'Accounting', rule_type: 'contains', match_field: 'vendor', match_value: 'Accounting', target_category: 'Legal & Admin', target_department: 'Admin', priority: 61 },
] as const
