import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const BUCKET = "lesson-files";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "text/plain",
  "text/csv",
];

export async function POST(request: Request) {
  try {
    // 1. Authenticate the caller (cookie session, or Bearer token fallback)
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    const supabase = await createClient();
    const { data: userData, error: authError } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();
    const user = userData?.user;

    if (authError || !user) {
      return NextResponse.json({ error: "Неавторизован" }, { status: 401 });
    }

    // 2. Verify the caller is an admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    // 3. Read and validate the uploaded file
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: "Недопустимый формат файла" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Файл больше 25 МБ" }, { status: 400 });
    }

    // 4. Upload via the admin (service role) client — bypasses storage RLS
    const adminClient = createAdminClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `lessons/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: `Не удалось загрузить файл: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicData } = adminClient.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ success: true, url: publicData.publicUrl, name: file.name });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Внутренняя ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
