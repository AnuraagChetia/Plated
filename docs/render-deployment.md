# Render free deployment

Create a Blueprint in Render connected to AnuraagChetia/Plated, branch main. The root render.yaml defines a free Node web service, the build/start commands, and persistent Supabase image storage. No paid disk or Render database is needed.

Supply the three prompted Supabase values from .env.local. The service role credential belongs only in Render's secret environment settings, never in source code or a NEXT_PUBLIC_ variable.

After Render reports Live, open the service URL and /r/khaoka. Check sign-in, owner controls, existing images and a temporary image replacement. Configure the public URL under Supabase Authentication URL Configuration if using confirmation or password-reset emails. Keep localhost redirect URLs while developing.

Free services sleep after inactivity; open the demo before presenting. Supabase Free can also pause inactive projects. Existing checkout remains real application data; avoid accidental orders while testing.
