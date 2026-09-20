-- Admin staff, multi-currency rails, and deposit-request approval.

alter table trading_accounts
  add column if not exists status text not null default 'active';

create table if not exists app_staff (
  user_id text primary key,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists app_currencies (
  code text primary key,
  name text not null,
  symbol text not null,
  units_per_usd double precision not null,
  enabled boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists payment_methods (
  id serial primary key,
  kind text not null,
  title text not null,
  currency text not null,
  details_json text not null default '{}',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists deposit_requests (
  id serial primary key,
  user_id text not null,
  method_id integer,
  method_kind text not null,
  method_title text not null,
  amount double precision not null,
  currency text not null,
  usd_credit double precision not null,
  payer_name text not null,
  reference text not null,
  note text,
  status text not null default 'pending',
  admin_id text,
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists deposit_requests_user_id_idx on deposit_requests (user_id);
create index if not exists deposit_requests_status_idx on deposit_requests (status);

insert into app_currencies (code, name, symbol, units_per_usd, enabled, sort_order)
values
  ('USD', 'US Dollar', '$', 1, true, 0),
  ('INR', 'Indian Rupee', '₹', 83.5, true, 1),
  ('EUR', 'Euro', '€', 0.92, true, 2),
  ('GBP', 'British Pound', '£', 0.78, true, 3),
  ('AED', 'UAE Dirham', 'AED', 3.67, true, 4),
  ('AUD', 'Australian Dollar', 'A$', 1.52, true, 5),
  ('CAD', 'Canadian Dollar', 'C$', 1.36, true, 6),
  ('SGD', 'Singapore Dollar', 'S$', 1.35, true, 7),
  ('HKD', 'Hong Kong Dollar', 'HK$', 7.8, true, 8),
  ('JPY', 'Japanese Yen', '¥', 148, true, 9)
on conflict (code) do nothing;

insert into payment_methods (kind, title, currency, details_json, enabled, sort_order)
select * from (
  values
    (
      'upi',
      'UPI',
      'INR',
      '{"vpa":"nexora@demo","payee":"Nexora Markets","note":"NEXORA desk"}',
      true,
      0
    ),
    (
      'qr',
      'UPI QR',
      'INR',
      '{"vpa":"nexora@demo","payee":"Nexora Markets","note":"NEXORA desk"}',
      true,
      1
    ),
    (
      'bank',
      'INR bank transfer',
      'INR',
      '{"bankName":"Demo Bank of Markets","accountName":"Nexora Markets Ltd","accountNumber":"000000000000","ifsc":"DEMO0000001","branch":"Mumbai"}',
      true,
      2
    ),
    (
      'bank',
      'USD wire',
      'USD',
      '{"bankName":"Demo Correspondent Bank","accountName":"Nexora Markets Ltd","accountNumber":"4000000000","ifsc":"","swift":"DEMOUS33","iban":"","branch":"New York"}',
      true,
      3
    )
) as seed(kind, title, currency, details_json, enabled, sort_order)
where not exists (select 1 from payment_methods);
