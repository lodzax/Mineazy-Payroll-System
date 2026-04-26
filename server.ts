import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Admin User Creation API
  app.post("/api/admin/create-user", async (req, res) => {
    if (!adminClient) {
      return res.status(500).json({ error: "Supabase Admin client not initialized. Check SUPABASE_SERVICE_ROLE_KEY." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization" });

    try {
      const token = authHeader.split(" ")[1];
      const { data: { user: requester }, error: authError } = await adminClient.auth.getUser(token);
      
      if (authError || !requester) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired session." });
      }

      // Check if requester is authorized
      const { data: profile } = await adminClient
        .from("users")
        .select("role")
        .eq("id", requester.id)
        .single();

      const isAuthorized = requester.email === 'lodzax@gmail.com' || 
                           requester.email === 'accounts@mineazy.co.zw' ||
                           ['admin', 'superadmin', 'management'].includes(profile?.role);

      if (!isAuthorized) {
        return res.status(403).json({ error: "Permission Denied: Admin privileges required." });
      }

      const { email, password, fullName, metadata } = req.body;

      if (!email || !fullName) {
        return res.status(400).json({ error: "Email and Full Name are required." });
      }

      // 1. Create Auth User
      let userId: string;
      const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: password || "Mining2026!", // Strong default password
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });

      if (createError) {
        if (createError.message.includes("already been registered")) {
          // User exists, try to fetch to get ID
          const { data: searchResult, error: searchError } = await adminClient.auth.admin.listUsers();
          if (searchError) throw searchError;
          
          const existingUser = searchResult.users.find((u: any) => u.email === email);
          if (!existingUser) throw new Error("User exists but could not be retrieved.");
          
          userId = existingUser.id;
        } else {
          throw createError;
        }
      } else {
        userId = authUser.user.id;
      }

      // Clean metadata: replace empty strings with null for potential UUID fields
      const sanitizedMetadata = { ...metadata };
      if (sanitizedMetadata.subsidiary_id === "") sanitizedMetadata.subsidiary_id = null;

      // 2. Setup Profile in public.users
      const { error: profileError } = await adminClient
        .from("users")
        .upsert({
          id: userId,
          email,
          full_name: fullName,
          ...sanitizedMetadata,
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      res.status(201).json({ 
        message: "Personnel account initialized successfully.", 
        user: { id: userId, email: email } 
      });

    } catch (err: any) {
      console.error("Admin user creation failure:", err);
      res.status(err.status || 400).json({ error: err.message || "Internal server error" });
    }
  });

  // Render provides the PORT environment variable
  const PORT = Number(process.env.PORT) || 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
