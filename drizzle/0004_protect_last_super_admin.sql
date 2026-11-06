-- Serializes removals of global super-admin grants, preserving at least one.
CREATE OR REPLACE FUNCTION protect_last_super_admin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_role text; another_grant boolean;
BEGIN
 IF OLD.category_id IS NOT NULL THEN
  IF TG_OP='UPDATE' THEN RETURN NEW; ELSE RETURN OLD; END IF;
 END IF;
 EXECUTE format('SELECT name FROM %I.roles WHERE id=$1',TG_TABLE_SCHEMA) INTO old_role USING OLD.role_id;
 IF old_role IS DISTINCT FROM 'super_admin' THEN
  IF TG_OP='UPDATE' THEN RETURN NEW; ELSE RETURN OLD; END IF;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.role_id=OLD.role_id AND NEW.category_id IS NULL AND NEW.user_id=OLD.user_id THEN RETURN NEW; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(28192014);
 EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.user_permissions p JOIN %I.roles r ON r.id=p.role_id WHERE p.id<>$1 AND p.category_id IS NULL AND r.name=''super_admin'')',TG_TABLE_SCHEMA,TG_TABLE_SCHEMA) INTO another_grant USING OLD.id;
 IF NOT another_grant THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='LAST_SUPER_ADMIN_REQUIRED';
 END IF;
 IF TG_OP='UPDATE' THEN RETURN NEW; ELSE RETURN OLD; END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER preserve_last_super_admin BEFORE DELETE OR UPDATE ON user_permissions
FOR EACH ROW EXECUTE FUNCTION protect_last_super_admin();
