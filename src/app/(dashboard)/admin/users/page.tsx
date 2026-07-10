"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Course, UserCourse } from "@/types";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/components/shared/toast-provider";
import { Shield, ShieldAlert, CheckCircle2, ChevronDown, ChevronUp, Loader2, UserPlus, X, Trash2, AlertTriangle } from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [userCourses, setUserCourses] = useState<UserCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "student" as "admin" | "student",
    isApproved: true,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const supabase = createClient();
  const { addToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, coursesRes, userCoursesRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("courses").select("*").order("created_at"),
        supabase.from("user_courses").select("*")
      ]);

      if (profilesRes.data) setUsers(profilesRes.data);
      if (coursesRes.data) setCourses(coursesRes.data);
      if (userCoursesRes.data) setUserCourses(userCoursesRes.data);
    } catch (error) {
      console.error("Error loading admin data:", error);
      addToast("Ошибка загрузки данных", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleApproval = async (userId: string, currentStatus: boolean) => {
    setProcessingId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: !currentStatus })
        .eq("id", userId);

      if (error) throw error;
      
      setUsers(users.map(u => u.id === userId ? { ...u, is_approved: !currentStatus } : u));
      addToast(currentStatus ? "Доступ закрыт" : "Пользователь одобрен", "success");
    } catch (error) {
      console.error(error);
      addToast("Ошибка при изменении статуса", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const toggleCourseAccess = async (userId: string, courseId: string, hasAccess: boolean) => {
    setProcessingId(`${userId}-${courseId}`);
    try {
      if (hasAccess) {
        // Revoke
        const { error } = await supabase
          .from("user_courses")
          .delete()
          .match({ user_id: userId, course_id: courseId });
        
        if (error) throw error;
        setUserCourses(userCourses.filter(uc => !(uc.user_id === userId && uc.course_id === courseId)));
      } else {
        // Grant
        const { data, error } = await supabase
          .from("user_courses")
          .insert({ user_id: userId, course_id: courseId })
          .select()
          .single();
          
        if (error) throw error;
        if (data) setUserCourses([...userCourses, data as UserCourse]);
      }
      addToast("Доступы обновлены", "success");
    } catch (error) {
      console.error(error);
      addToast("Ошибка при обновлении доступов", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Не удалось удалить пользователя");
      }

      setUsers(users.filter(u => u.id !== userId));
      setUserCourses(userCourses.filter(uc => uc.user_id !== userId));
      if (expandedUserId === userId) setExpandedUserId(null);
      addToast("Пользователь удалён", "success");
      setUserToDelete(null);
    } catch (error: any) {
      console.error(error);
      addToast(error.message || "Ошибка при удалении пользователя", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  const generatePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      password: "",
      role: "student",
      isApproved: true,
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Не удалось создать пользователя");
      }

      addToast("Пользователь успешно создан", "success");
      setIsAddModalOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error(error);
      addToast(error.message || "Ошибка при создании пользователя", "error");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card border border-border rounded-2xl p-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Список пользователей</h2>
          <p className="text-xs text-muted">Зарегистрированные пользователи и их доступы</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-accent/10 hover:shadow-accent/20 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Добавить пользователя
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-card-hover/50">
              <th className="p-4 text-sm font-semibold text-muted">Пользователь</th>
              <th className="p-4 text-sm font-semibold text-muted">Роль</th>
              <th className="p-4 text-sm font-semibold text-muted">Статус</th>
              <th className="p-4 text-sm font-semibold text-muted text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => {
              const isExpanded = expandedUserId === user.id;
              const isProcessing = processingId === user.id;
              
              return (
                <React.Fragment key={user.id}>
                  <tr className={`hover:bg-card-hover/50 transition-colors ${isExpanded ? 'bg-card-hover/30' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full bg-border object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-medium">
                            {getInitials(user.full_name || "US")}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-foreground">{user.full_name || "Без имени"}</div>
                          <div className="text-xs text-muted">{user.email || "Нет email"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {user.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">
                          <Shield className="w-3 h-3" />
                          Админ
                        </span>
                      ) : (
                        <span className="text-sm text-muted">Студент</span>
                      )}
                    </td>
                    <td className="p-4">
                      {user.is_approved ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-success">
                          <CheckCircle2 className="w-4 h-4" />
                          Одобрен
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm text-warning">
                          <ShieldAlert className="w-4 h-4" />
                          Ожидает
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.role !== "admin" && (
                          <>
                            {!user.is_approved && (
                              <button
                                onClick={() => toggleApproval(user.id, user.is_approved)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-success/10 text-success hover:bg-success/20"
                              >
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Одобрить"}
                              </button>
                            )}
                            <button
                              onClick={() => setUserToDelete(user)}
                              disabled={isProcessing}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-error/10 text-error hover:bg-error/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Удалить
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
                          title="Управление доступами к курсам"
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr className="bg-card-hover/10">
                      <td colSpan={4} className="p-0">
                        <div className="p-6 border-b border-border">
                          <h4 className="text-sm font-semibold text-foreground mb-4">Доступ к курсам</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {courses.map(course => {
                              const hasAccess = userCourses.some(uc => uc.user_id === user.id && uc.course_id === course.id);
                              const isToggling = processingId === `${user.id}-${course.id}`;
                              
                              return (
                                <div key={course.id} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border bg-card hover:border-accent/30 transition-colors min-w-0">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasAccess ? 'bg-success glow-accent' : 'bg-muted/30'}`} />
                                    <span className="text-sm font-medium text-foreground truncate" title={course.title}>
                                      {course.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className={`text-xs font-medium ${hasAccess ? 'text-success' : 'text-muted'}`}>
                                      {isToggling ? "Загрузка..." : (hasAccess ? "Открыт" : "Закрыт")}
                                    </span>
                                    <button
                                      onClick={() => toggleCourseAccess(user.id, course.id, hasAccess)}
                                      disabled={isToggling}
                                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background ${
                                        hasAccess ? 'bg-success' : 'bg-muted/50'
                                      }`}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                          hasAccess ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
      
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-full bg-error/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-error" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground">Удалить пользователя?</h3>
                  <p className="text-sm text-muted mt-1">
                    {userToDelete.full_name || userToDelete.email || "Пользователь"} будет удалён безвозвратно.
                    Вместе с аккаунтом удалятся профиль, прогресс по урокам и все доступы к курсам. Действие нельзя отменить.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-border hover:bg-card-hover rounded-xl text-sm font-medium text-foreground transition-colors cursor-pointer disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteUser(userToDelete.id)}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-4 py-2 bg-error hover:bg-error/90 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Добавить пользователя</h3>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                }}
                className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body / Form */}
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  ФИО
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Иван Иванов"
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex justify-between items-center">
                  <span>Пароль</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, password: generatePassword() })}
                    className="text-[10px] font-medium text-accent hover:underline cursor-pointer"
                  >
                    Сгенерировать
                  </button>
                </label>
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Минимум 6 символов"
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Роль
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "student" })}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                  >
                    <option value="student">Студент</option>
                    <option value="admin">Администратор</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Одобрить сразу
                  </label>
                  <div className="flex items-center h-[38px]">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isApproved: !formData.isApproved })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        formData.isApproved ? 'bg-success' : 'bg-muted/50'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          formData.isApproved ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-border hover:bg-card-hover rounded-xl text-sm font-medium text-foreground transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
