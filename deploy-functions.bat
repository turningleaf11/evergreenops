@echo off
REM Deploy all edge functions to new Supabase project
REM Run this from the evergreenops directory

REM Set your new Supabase project ID
set NEW_PROJECT_ID=dsxrekabnwvarnroanny

REM Login to Supabase (you'll need to do this once)
REM supabase login

REM Link to the new project
supabase link --project-ref %NEW_PROJECT_ID%

REM Deploy all functions from supabase/functions/
echo Deploying edge functions...
for /d %%d in (supabase\functions\*) do (
    set "func_name=%%~nxd"
    echo Deploying !func_name!...
    supabase functions deploy !func_name! --no-verify-jwt
)

echo Done!
pause