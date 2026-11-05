-- Dataset dimostrativo, nessun dato personale reale.
INSERT INTO seasons (id,name,starts_on,ends_on) VALUES ('10000000-0000-4000-8000-000000000001','DEMO 2026/27','2026-07-01','2027-06-30');
--> statement-breakpoint
INSERT INTO categories (id,name,slug,is_youth) VALUES ('20000000-0000-4000-8000-000000000001','Prima Squadra — DEMO','prima-squadra-demo',false),('20000000-0000-4000-8000-000000000002','Juniores — DEMO','juniores-demo',true);
--> statement-breakpoint
INSERT INTO teams (id,name,category_id,season_id,is_club) VALUES ('30000000-0000-4000-8000-000000000001','San Lorenzo — DEMO','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true),('30000000-0000-4000-8000-000000000002','Atletico Collina — DEMO','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',false);
--> statement-breakpoint
INSERT INTO competitions (id,name,category_id,season_id,standings_enabled) VALUES ('40000000-0000-4000-8000-000000000001','Campionato dimostrativo','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true);
--> statement-breakpoint
INSERT INTO competition_teams (competition_id,team_id,season_id) VALUES ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');
--> statement-breakpoint
INSERT INTO matches (id,competition_id,home_team_id,away_team_id,kickoff,status,home_score,away_score) VALUES ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','2026-10-25T14:30:00Z','finished',2,1);
