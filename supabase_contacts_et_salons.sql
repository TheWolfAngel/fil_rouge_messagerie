-- =====================================================================
-- CONTACTS ET SALONS PUBLICS
-- À exécuter UNE fois dans Supabase : SQL Editor > New query > coller > Run
-- (projet Supabase utilisé par supabase.js)
-- Le script peut être relancé sans danger.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. MES CONTACTS : chaque utilisateur garde sa propre liste
-- ---------------------------------------------------------------------
create table if not exists public.contacts (
    proprietaire_id uuid not null default auth.uid()
        references auth.users (id) on delete cascade,
    contact_id uuid not null
        references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (proprietaire_id, contact_id)
);

alter table public.contacts enable row level security;

drop policy if exists "voir mes contacts" on public.contacts;
create policy "voir mes contacts" on public.contacts
    for select to authenticated using (proprietaire_id = auth.uid());

drop policy if exists "ajouter un contact" on public.contacts;
create policy "ajouter un contact" on public.contacts
    for insert to authenticated with check (proprietaire_id = auth.uid());

drop policy if exists "retirer un contact" on public.contacts;
create policy "retirer un contact" on public.contacts
    for delete to authenticated using (proprietaire_id = auth.uid());


-- ---------------------------------------------------------------------
-- 2. SALONS PUBLICS : une conversation avec un nom, ouverte à tous
-- ---------------------------------------------------------------------
alter table public.conversations add column if not exists nom text;
alter table public.conversations add column if not exists est_public boolean not null default false;

-- Un salon n'a pas de deuxième participant
alter table public.conversations alter column utilisateur_2 drop not null;

-- Deux salons ne peuvent pas avoir le même nom
create unique index if not exists salons_nom_unique
    on public.conversations (lower(nom)) where est_public;

-- Tout utilisateur connecté peut voir et créer un salon public
drop policy if exists "voir les salons publics" on public.conversations;
create policy "voir les salons publics" on public.conversations
    for select to authenticated using (est_public);

drop policy if exists "creer un salon public" on public.conversations;
create policy "creer un salon public" on public.conversations
    for insert to authenticated
    with check (est_public and utilisateur_1 = auth.uid() and nom is not null);

-- Messages des salons : tout le monde lit, chacun écrit en son nom
drop policy if exists "lire les messages des salons" on public.messages;
create policy "lire les messages des salons" on public.messages
    for select to authenticated
    using (exists (select 1 from public.conversations c
                   where c.id = conversation_id and c.est_public));

drop policy if exists "ecrire dans les salons" on public.messages;
create policy "ecrire dans les salons" on public.messages
    for insert to authenticated
    with check (expediteur_id = auth.uid()
                and exists (select 1 from public.conversations c
                            where c.id = conversation_id and c.est_public));

-- Réactions dans les salons
drop policy if exists "voir les reactions des salons" on public.reactions;
create policy "voir les reactions des salons" on public.reactions
    for select to authenticated
    using (exists (select 1 from public.messages m
                   join public.conversations c on c.id = m.conversation_id
                   where m.id = message_id and c.est_public));

drop policy if exists "reagir dans les salons" on public.reactions;
create policy "reagir dans les salons" on public.reactions
    for insert to authenticated
    with check (utilisateur_id = auth.uid()
                and exists (select 1 from public.messages m
                            join public.conversations c on c.id = m.conversation_id
                            where m.id = message_id and c.est_public));

drop policy if exists "retirer sa reaction dans les salons" on public.reactions;
create policy "retirer sa reaction dans les salons" on public.reactions
    for delete to authenticated
    using (utilisateur_id = auth.uid()
           and exists (select 1 from public.messages m
                       join public.conversations c on c.id = m.conversation_id
                       where m.id = message_id and c.est_public));
