"""Create the public, owner-scoped profile avatar bucket when Supabase Storage exists.

The local PostgreSQL schema does not install Supabase's ``storage`` extension, so
this migration deliberately no-ops there. Supabase's storage schema gets the full
bucket limit and RLS policy set.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0023_avatar_storage"
down_revision: str | None = "0022_catalog_title_search_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF to_regclass('storage.buckets') IS NULL
             OR to_regclass('storage.objects') IS NULL THEN
            RETURN;
          END IF;

          -- Expo web uploads the picked file's real type (native re-encodes to JPEG), so all
          -- three must be allowed or web picks fail. SVG stays out on purpose: this bucket is
          -- public and the client declares its own Content-Type, so allowing svg+xml would make
          -- it a stored-XSS primitive served from the Supabase origin.
          INSERT INTO storage.buckets
            (id, name, public, file_size_limit, allowed_mime_types)
          VALUES
            ('avatars', 'avatars', TRUE, 5242880,
             ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            public = EXCLUDED.public,
            file_size_limit = EXCLUDED.file_size_limit,
            allowed_mime_types = EXCLUDED.allowed_mime_types;

          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'storage' AND tablename = 'objects'
              AND policyname = 'avatars_insert_own'
          ) THEN
            CREATE POLICY avatars_insert_own ON storage.objects
              FOR INSERT TO authenticated
              WITH CHECK (
                bucket_id = 'avatars'
                AND name IN (
                  (SELECT auth.uid()::text) || '/avatar-a',
                  (SELECT auth.uid()::text) || '/avatar-b'
                )
              );
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'storage' AND tablename = 'objects'
              AND policyname = 'avatars_select_own'
          ) THEN
            CREATE POLICY avatars_select_own ON storage.objects
              FOR SELECT TO authenticated
              USING (
                bucket_id = 'avatars'
                AND name IN (
                  (SELECT auth.uid()::text) || '/avatar-a',
                  (SELECT auth.uid()::text) || '/avatar-b'
                )
              );
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'storage' AND tablename = 'objects'
              AND policyname = 'avatars_update_own'
          ) THEN
            CREATE POLICY avatars_update_own ON storage.objects
              FOR UPDATE TO authenticated
              USING (
                bucket_id = 'avatars'
                AND name IN (
                  (SELECT auth.uid()::text) || '/avatar-a',
                  (SELECT auth.uid()::text) || '/avatar-b'
                )
              )
              WITH CHECK (
                bucket_id = 'avatars'
                AND name IN (
                  (SELECT auth.uid()::text) || '/avatar-a',
                  (SELECT auth.uid()::text) || '/avatar-b'
                )
              );
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'storage' AND tablename = 'objects'
              AND policyname = 'avatars_delete_own'
          ) THEN
            CREATE POLICY avatars_delete_own ON storage.objects
              FOR DELETE TO authenticated
              USING (
                bucket_id = 'avatars'
                AND name IN (
                  (SELECT auth.uid()::text) || '/avatar-a',
                  (SELECT auth.uid()::text) || '/avatar-b'
                )
              );
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF to_regclass('storage.objects') IS NULL THEN
            RETURN;
          END IF;
          DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
          DROP POLICY IF EXISTS avatars_select_own ON storage.objects;
          DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
          DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
        END $$;
        """
    )
