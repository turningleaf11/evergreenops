#!/bin/bash
# Deploy all edge functions to new Supabase project
# Run this from the evergreenops directory

# Set your new Supabase project ID
NEW_PROJECT_ID="dsxrekabnwvarnroanny"

# Login to Supabase (you'll need to do this once)
# supabase login

# Link to the new project
supabase link --project-ref $NEW_PROJECT_ID

# Deploy all functions from supabase/functions/
echo "Deploying edge functions..."
for dir in supabase/functions/*/; do
  func_name=$(basename "$dir")
  echo "Deploying $func_name..."
  supabase functions deploy "$func_name" --no-verify-jwt
done

echo "Done! Deployed $(ls -1 supabase/functions/ | wc -l) functions."