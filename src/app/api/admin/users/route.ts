import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  console.log("=== API Route /api/admin/users POST called ===");
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    // 1. Authenticate the admin
    const supabase = await createClient();
    let user = null;
    let authError = null;

    if (token) {
      console.log("Authenticating using Bearer token from Authorization header...");
      const { data, error } = await supabase.auth.getUser(token);
      user = data.user;
      authError = error;
    } else {
      console.log("No Bearer token found. Authenticating using cookies...");
      const { data, error } = await supabase.auth.getUser();
      user = data.user;
      authError = error;
    }

    if (authError || !user) {
      console.error("Auth check failed:", authError);
      return NextResponse.json({ error: "Неавторизован" }, { status: 401 });
    }
    console.log("Authenticated caller:", user.email, "ID:", user.id);

    // 2. Check if the user is an admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      console.error("Caller is not admin or profile fetch failed:", profileError, "Role:", profile?.role);
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }
    console.log("Caller is confirmed admin!");

    // 3. Parse and validate the request body
    const body = await request.json();
    const { email, password, fullName, role, isApproved } = body;
    console.log("Request body parameters:", { email, passwordLength: password?.length, fullName, role, isApproved });

    if (!email || !password || !fullName || !role) {
      console.error("Validation failed: missing fields");
      return NextResponse.json(
        { error: "Не заполнены обязательные поля: email, password, fullName, role" },
        { status: 400 }
      );
    }

    if (role !== "admin" && role !== "student") {
      console.error("Validation failed: invalid role", role);
      return NextResponse.json({ error: "Недопустимая роль" }, { status: 400 });
    }

    // 4. Create user in Supabase Auth using the Admin client
    console.log("Creating user in Auth...");
    const adminClient = createAdminClient();
    const { data: authData, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      }
    });

    if (createUserError || !authData.user) {
      console.error("Auth creation failed:", createUserError);
      return NextResponse.json(
        { error: createUserError?.message || "Не удалось создать пользователя" },
        { status: 500 }
      );
    }

    const newUserId = authData.user.id;
    console.log("Auth user created successfully! New User ID:", newUserId);

    // 5. Update the public.profiles table (created by the DB trigger)
    console.log("Updating profile in DB...");
    const { data: updatedProfile, error: updateError } = await adminClient
      .from("profiles")
      .update({
        full_name: fullName,
        role: role,
        is_approved: isApproved ?? true,
        email: email,
      })
      .eq("id", newUserId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating profile after creation:", updateError);
      // Try to return a friendly message
      return NextResponse.json(
        { error: `Пользователь создан в Auth, но не удалось обновить профиль: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log("Profile updated successfully:", updatedProfile);
    return NextResponse.json({
      success: true,
      user: updatedProfile
    });

  } catch (err: any) {
    console.error("Admin user creation endpoint error:", err);
    return NextResponse.json({ error: err.message || "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  console.log("=== API Route /api/admin/users DELETE called ===");
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    // 1. Authenticate the caller (Bearer token, or cookie session as fallback)
    const supabase = await createClient();
    const { data: authData, error: authError } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();
    const caller = authData?.user;

    if (authError || !caller) {
      return NextResponse.json({ error: "Неавторизован" }, { status: 401 });
    }

    // 2. Verify the caller is an admin
    const { data: callerProfile, error: callerError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerError || callerProfile?.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    // 3. Parse and validate the target user id
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "Не передан userId" }, { status: 400 });
    }
    if (userId === caller.id) {
      return NextResponse.json({ error: "Нельзя удалить самого себя" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 4. Guard: never delete another administrator
    const { data: target } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (target?.role === "admin") {
      return NextResponse.json({ error: "Нельзя удалить администратора" }, { status: 400 });
    }

    // 5. Explicitly remove the user's data (FKs also cascade, but be deterministic)
    await adminClient.from("progress").delete().eq("user_id", userId);
    await adminClient.from("user_lesson_access").delete().eq("user_id", userId);
    await adminClient.from("user_courses").delete().eq("user_id", userId);

    // 6. Delete the auth user — cascades the profile row via ON DELETE CASCADE
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Auth user deletion failed:", deleteError);
      return NextResponse.json(
        { error: `Не удалось удалить пользователя: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Admin user deletion endpoint error:", err);
    const message = err instanceof Error ? err.message : "Внутренняя ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
