-- GYF Postgres schema — GENERATED SNAPSHOT, NON-AUTHORITATIVE.
-- Source of truth is Alembic (services/api/db/migrations/). Regenerate with:
--   docker exec infra-postgres-1 pg_dump -U postgres -d gyf --schema-only --no-owner --no-privileges
-- The DB is built from migrations alone (the API migrates to head on boot);
-- this file is a human-readable reference only and is never side-loaded.

-- PostgreSQL database dump


-- Dumped from database version 16.14 (Debian 16.14-1.pgdg12+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


-- Name: vector; Type: EXTENSION; Schema: -; Owner: -

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


SET default_tablespace = '';

SET default_table_access_method = heap;

-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


-- Name: interactions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.interactions (
    id bigint NOT NULL,
    event_id uuid,
    user_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    action text NOT NULL,
    weight real,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL
);


-- Name: interactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.interactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: interactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.interactions_id_seq OWNED BY public.interactions.id;


-- Name: item_embeddings; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.item_embeddings (
    item_id uuid NOT NULL,
    embedding public.vector(768) NOT NULL,
    model_version text NOT NULL
);


-- Name: items; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    retailer_id text,
    title text NOT NULL,
    category text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    price numeric,
    currency text,
    region_tags text[] DEFAULT '{}'::text[] NOT NULL,
    affiliate_url text,
    image_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_provider text,
    source_license text,
    image_hash text,
    dedupe_key text
);


-- Name: models; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.models (
    name text NOT NULL,
    version text NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT models_status_check CHECK ((status = ANY (ARRAY['shadow'::text, 'canary'::text, 'prod'::text, 'rolled_back'::text])))
);


-- Name: outfits; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.outfits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_ids uuid[] NOT NULL,
    occasion text,
    compatibility_score real,
    generated_by text,
    explanation text,
    confidence real,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: profiles; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.profiles (
    user_id uuid NOT NULL,
    skin_tone text,
    undertone text,
    body_type text,
    measurements jsonb,
    style_intent jsonb,
    budget_range jsonb,
    source text,
    field_confidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    model_version text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_source_check CHECK ((source = ANY (ARRAY['photo'::text, 'manual'::text])))
);


-- Name: users; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region text,
    locale text,
    consent_flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: interactions id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.interactions ALTER COLUMN id SET DEFAULT nextval('public.interactions_id_seq'::regclass);


-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


-- Name: interactions interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_pkey PRIMARY KEY (id);


-- Name: item_embeddings item_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.item_embeddings
    ADD CONSTRAINT item_embeddings_pkey PRIMARY KEY (item_id);


-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


-- Name: models models_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.models
    ADD CONSTRAINT models_pkey PRIMARY KEY (name, version);


-- Name: outfits outfits_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.outfits
    ADD CONSTRAINT outfits_pkey PRIMARY KEY (id);


-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);


-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


-- Name: idx_interactions_user_action; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_interactions_user_action ON public.interactions USING btree (user_id, action, ts DESC);


-- Name: idx_interactions_user_ts; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_interactions_user_ts ON public.interactions USING btree (user_id, ts DESC);

CREATE UNIQUE INDEX uq_interactions_event_id ON public.interactions USING btree (event_id);


-- Name: idx_item_embeddings_hnsw; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_item_embeddings_hnsw ON public.item_embeddings USING hnsw (embedding public.vector_cosine_ops);


-- Name: uq_items_dedupe_key; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX uq_items_dedupe_key ON public.items USING btree (dedupe_key);


-- Name: interactions interactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Name: item_embeddings item_embeddings_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.item_embeddings
    ADD CONSTRAINT item_embeddings_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- PostgreSQL database dump complete
