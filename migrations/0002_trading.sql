create table if not exists trading_accounts (
  user_id text primary key,
  balance double precision not null default 0,
  pricing text not null default 'standard',
  selected text not null default 'EURUSD',
  positions_json text not null default '[]',
  pending_json text not null default '[]',
  history_json text not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists trading_ledger (
  id serial primary key,
  user_id text not null,
  kind text not null,
  amount double precision not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists trading_ledger_user_id_idx on trading_ledger (user_id);
