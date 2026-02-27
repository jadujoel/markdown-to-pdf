import { serve } from "bun";
import index from "./index.html";
import { convertMarkdown } from "./convert";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const server = serve({
  routes: {
    "/*": index,

    "/api/convert": {
      async POST(req) {
        try {
          const contentType = req.headers.get("content-type") ?? "";

          let markdown = "";
          let format: "pdf" | "png" = "pdf";
          let preventImageSplit = true;

          if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const file = formData.get("file") as File | null;
            const text = formData.get("markdown") as string | null;
            format = (formData.get("format") as string) === "png" ? "png" : "pdf";
            preventImageSplit = (formData.get("preventImageSplit") as string) !== "false";

            if (file && file.size > 0) {
              if (file.size > MAX_SIZE) {
                return Response.json({ error: "File too large (max 5MB)" }, { status: 400 });
              }
              markdown = await file.text();
            } else if (text) {
              markdown = text;
            }
          } else {
            const body = await req.json();
            markdown = body.markdown ?? "";
            format = body.format === "png" ? "png" : "pdf";
            preventImageSplit = body.preventImageSplit !== false;
          }

          if (!markdown.trim()) {
            return Response.json({ error: "No markdown content provided" }, { status: 400 });
          }

          const result = await convertMarkdown(markdown, format, {
            preventImageSplit,
          });

          const mime = format === "pdf" ? "application/pdf" : "image/png";
          const ext = format;

          return new Response(result as any, {
            headers: {
              "Content-Type": mime,
              "Content-Disposition": `attachment; filename="document.${ext}"`,
              "Content-Length": result.byteLength.toString(),
            },
          });
        } catch (err) {
          console.error("Conversion error:", err);
          return Response.json(
            { error: "Conversion failed. Please try again." },
            { status: 500 }
          );
        }
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
