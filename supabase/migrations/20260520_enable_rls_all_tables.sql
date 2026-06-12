-- Enable RLS on all public tables exposed via PostgREST
-- Service role key bypasses RLS, so backend access is unaffected.

-- App tables
ALTER TABLE public."AutoPost"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Comments"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ComplianceJob"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Credits"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Customer"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Errors"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ExisingPlugData"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GitHub"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Integration"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IntegrationsWebhooks"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ItemUser"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Media"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Mentions"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Messages"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MessagesGroup"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notifications"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OAuthApp"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OAuthAuthorization"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItems"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Orders"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Organization"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PayoutProblems"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Plugs"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PopularPosts"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Post"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Sets"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Signatures"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SocialMediaAgency"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SocialMediaAgencyNiche" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Star"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Subscription"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tags"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TagsPosts"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Template"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ThirdParty"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Trending"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TrendingLog"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UsedCodes"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserOrganization"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Webhooks"               ENABLE ROW LEVEL SECURITY;

-- Mastra internal tables
ALTER TABLE public.mastra_agent_versions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_agents                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_ai_spans                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_dataset_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_dataset_versions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_datasets                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_evals                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_experiment_results          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_experiments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_mcp_client_versions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_mcp_clients                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_mcp_server_versions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_mcp_servers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_messages                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_observational_memory        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_prompt_block_versions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_prompt_blocks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_resources                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_scorer_definition_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_scorer_definitions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_scorers                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_skill_blobs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_skill_versions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_skills                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_threads                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_traces                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_workflow_snapshot           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_workspace_versions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_workspaces                  ENABLE ROW LEVEL SECURITY;

-- Fix function search_path (WARN: function_search_path_mutable)
CREATE OR REPLACE FUNCTION public.trigger_set_timestamps()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW."createdAt" = NOW();
        NEW."updatedAt" = NOW();
        NEW."createdAtZ" = NOW();
        NEW."updatedAtZ" = NOW();
    ELSIF TG_OP = 'UPDATE' THEN
        NEW."updatedAt" = NOW();
        NEW."updatedAtZ" = NOW();
        NEW."createdAt" = OLD."createdAt";
        NEW."createdAtZ" = OLD."createdAtZ";
    END IF;
    RETURN NEW;
END;
$function$;
