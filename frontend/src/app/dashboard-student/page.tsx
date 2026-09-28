"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { fetchCurrentUser, fetchUserProfile, updateUserData, updateUserProfile } from "@/actions/getUser";
import { fetchUserStatistics, fetchInprogressCourses, fetchCompletedCourses } from "@/actions/getEnrollment";
import { fetchUserCertificates } from "@/actions/getCertificate";
import { CertificateItem } from "@/types/certificate";
import { UserDataInfo, ProfileInfo } from "@/types/user";
import { GeneralUserEnrollmentInfo, CourseInProgress } from "@/types/enrollment";

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("learning");
  const [user, setUser] = useState<UserDataInfo | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statistics, setStatistics] = useState<GeneralUserEnrollmentInfo>({
    inprogress_courses: 0,
    completed_courses: 0,
    certificate: 0
  });
  const [learningCourses, setLearningCourses] = useState<CourseInProgress[]>([]);
  const [completedCourses, setCompletedCourses] = useState<CourseInProgress[]>([]);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    birthdate: "",
    firstname: "",
    lastname: "",
    bio: "",
    avatar_url: ""
  });

  async function loadAllData() {
    try {
      setLoading(true);
      setError(null);

      const [
        userData,
        profileData,
        statsData,
        inprogressData,
        completedData,
        certificatesData
      ] = await Promise.all([
        fetchCurrentUser(),
        fetchUserProfile(),
        fetchUserStatistics(),
        fetchInprogressCourses(),
        fetchCompletedCourses(),
        fetchUserCertificates()
      ]);

      setUser(userData);
      setProfile(profileData);
      setStatistics(statsData);
      setLearningCourses(inprogressData);
      setCompletedCourses(completedData);
      setCertificates(certificatesData);

      if (userData && profileData) {
        setFormData({
          username: userData.username || "",
          birthdate: userData.birthdate || "",
          firstname: profileData.firstname || "",
          lastname: profileData.lastname || "",
          bio: profileData.bio || "",
          avatar_url: profileData.avatar_url || ""
        });
      }
    } catch (err: any) {
      console.error("Lỗi khi tải thông tin:", err);
      setError(err.message || "Đã xảy ra lỗi khi kết nối hệ thống.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleContinueLearning = (courseId: string | number) => {
    router.push(`/course/${courseId}`);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.user_id) {
      setError("Không tìm thấy ID người dùng để cập nhật.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSubmitSuccess(null);

    try {
      const userPayload = {
        username: formData.username,
        birthdate: formData.birthdate,
      };

      const profilePayload = {
        firstname: formData.firstname,
        lastname: formData.lastname,
        bio: formData.bio,
        avatar_url: formData.avatar_url,
      };

      const [userOk, profileOk] = await Promise.all([
        updateUserData(user.user_id, userPayload),
        updateUserProfile(profilePayload)
      ]);

      if (userOk && profileOk) {
        setSubmitSuccess("Cập nhật thông tin hồ sơ thành công!");
        setIsEditing(false);
        await loadAllData();
      } else {
        setError("Cập nhật thất bại. Vui lòng kiểm tra lại thông tin.");
      }
    } catch (err: any) {
      console.error("Lỗi khi cập nhật:", err);
      setError("Đã xảy ra lỗi trong quá trình lưu dữ liệu.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Chưa cập nhật";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN");
    } catch {
      return dateString;
    }
  };

  const defaultAvatar = "https://www.w3schools.com/howto/img_avatar.png";
  const userAvatar = profile?.avatar_url || defaultAvatar;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Navbar />

      {/* Hero Banner */}
      <section className="bg-blue-600 border-b border-slate-200 pt-12 pb-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            
            {/* User Info Avatar Banner */}
            <div className="flex items-center gap-5 text-center sm:text-left">
              {loading ? (
                <div className="w-20 h-20 rounded-full bg-white/20 animate-pulse border-2 border-white/30 shrink-0" />
              ) : (
                <img
                  src={userAvatar}
                  alt="avatar"
                  className="w-20 h-20 rounded-full border-3 border-white/90 object-cover shadow-lg shrink-0"
                />
              )}

              <div>
                {loading ? (
                  <div className="h-9 w-56 bg-white/20 animate-pulse rounded mb-2"></div>
                ) : error && !user ? (
                  <h2 className="text-3xl font-semibold text-red-200">Không thể tải tên</h2>
                ) : (
                  <h2 className="text-3xl font-bold text-white tracking-tight">
                    Xin chào, {user?.username || "Thành viên"}
                  </h2>
                )}
                <p className="text-white/85 text-base mt-1 font-normal">Theo dõi tiến độ học tập và thành tích của bạn</p>
              </div>
            </div>

            {/* Nút Trang Chủ */}
            <button
              onClick={() => router.push("/home")}
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white text-white hover:text-blue-600 backdrop-blur-md px-5 py-3 rounded-xl border border-white/30 hover:border-white text-sm font-semibold shadow-sm transition-all duration-200 cursor-pointer shrink-0"
              title="Quay về trang chủ"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Trang chủ</span>
            </button>
          </div>
        </div>
      </section>

      {/* Statistics Cards */}
      <section className="max-w-5xl mx-auto px-6 -mt-10">
        <div className="grid md:grid-cols-3 gap-5">
          <StatCard title={statistics.inprogress_courses.toString()} text="Khóa học đang học" />
          <StatCard title={statistics.completed_courses.toString()} text="Khóa học hoàn thành" />
          <StatCard title={statistics.certificate.toString()} text="Chứng chỉ" />
        </div>
      </section>

      {/* Navigation Tabs - Đã Căn Chỉnh Lại Tỉ Lệ & Thanh Active Chuẩn UI */}
      <section className="max-w-5xl mx-auto px-6 mt-8">
        <div className="border-b border-slate-200">
          <nav className="flex gap-8 overflow-x-auto">
            {[
              { id: "learning", label: "Đang học" },
              { id: "completed", label: "Hoàn thành" },
              { id: "certificate", label: "Chứng chỉ" },
              { id: "profile", label: "Hồ sơ" }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3.5 text-sm md:text-base transition-all relative cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "text-blue-600 font-semibold"
                      : "text-slate-500 hover:text-slate-800 font-normal"
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 rounded-t-full shadow-xs" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      {/* Content Area */}
      <section className="max-w-5xl mx-auto px-6 py-6">
        <div className="w-full">

          {activeTab === "learning" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Khóa học đang học</h2>
              <div className="space-y-6">
                {learningCourses.length > 0 ? (
                  learningCourses.map((course, index) => (
                    <CourseProgressCard
                      key={course.course_id || index}
                      courseId={course.course_id}
                      title={course.course_title}
                      progress={course.current_overall_progress}
                      onContinue={handleContinueLearning}
                    />
                  ))
                ) : (
                  <p className="text-slate-500 py-12 text-center">Bạn chưa tham gia khóa học nào.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === "completed" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Khóa học hoàn thành</h2>
              <div className="space-y-4">
                {completedCourses.length > 0 ? (
                  completedCourses.map((course, index) => (
                    <CompletedCourse
                      key={course.course_id || index}
                      courseId={course.course_id}
                      title={course.course_title}
                      onReview={handleContinueLearning}
                    />
                  ))
                ) : (
                  <p className="text-slate-500 py-12 text-center">Bạn chưa hoàn thành khóa học nào.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === "certificate" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Chứng chỉ đã đạt được</h2>
              {certificates.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {certificates.map((cert, index) => (
                    <CertificateCard
                      key={index}
                      title={cert.course_name}
                      date={formatDate(cert.created_at)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 py-12 text-center">Bạn chưa nhận được chứng chỉ nào.</p>
              )}
            </div>
          )}

          {/* TAB HỒ SƠ */}
          {activeTab === "profile" && (
            <div className="space-y-4">
              {submitSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-sm font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {submitSuccess}
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {isEditing ? (
                <ProfileEditCard
                  formData={formData}
                  submitting={submitting}
                  defaultAvatar={defaultAvatar}
                  onInputChange={handleInputChange}
                  onSubmit={handleFormSubmit}
                  onCancel={() => {
                    setIsEditing(false);
                    setError(null);
                  }}
                />
              ) : (
                <ProfileViewCard
                  user={user}
                  profile={profile}
                  userAvatar={userAvatar}
                  formatDate={formatDate}
                  onStartEdit={() => setIsEditing(true)}
                  loading={loading}
                />
              )}
            </div>
          )}

        </div>
      </section>
    </div>
  );
}

/* ====================================================================
   SUB-COMPONENTS
   ==================================================================== */
interface ProfileViewCardProps {
  user: UserDataInfo | null;
  profile: ProfileInfo | null;
  userAvatar: string;
  formatDate: (d?: string) => string;
  onStartEdit: () => void;
  loading: boolean;
}

function ProfileViewCard({ user, profile, userAvatar, formatDate, onStartEdit, loading }: ProfileViewCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-4 animate-pulse">
        <div className="h-24 bg-slate-100 rounded-2xl"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-16 bg-slate-100 rounded-xl"></div>
          <div className="h-16 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
      <div className="flex justify-between items-center pb-6 border-b border-slate-100 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Hồ sơ cá nhân</h2>
          <p className="text-sm text-slate-500 mt-0.5">Thông tin tài khoản và cá nhân của bạn</p>
        </div>
        <button
          onClick={onStartEdit}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Chỉnh sửa hồ sơ
        </button>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 p-6 bg-gradient-to-r from-blue-50/60 to-slate-50 rounded-2xl border border-blue-100/60">
          <img
            src={userAvatar}
            alt="Avatar"
            className="w-20 h-20 rounded-full border-2 border-white shadow-md object-cover shrink-0"
          />
          <div className="text-center sm:text-left flex-1">
            <h3 className="text-xl font-bold text-slate-900">{user.username}</h3>
            <p className="text-sm text-slate-500 mt-1">{user.email}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <ProfileDetailCard
            label="Ngày sinh"
            value={formatDate(user.birthdate)}
            icon={
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />

          <ProfileDetailCard
            label="Ngày tham gia"
            value={formatDate(user.created_at)}
            icon={
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tiểu sử / Giới thiệu bản thân</h4>
          <p className="text-slate-700 text-sm leading-relaxed italic bg-slate-50 p-4 rounded-xl border border-slate-100">
            {profile?.bio || "Chưa có thông tin giới thiệu bản thân."}
          </p>
        </div>
      </div>
    </div>
  );
}

interface ProfileEditCardProps {
  formData: any;
  submitting: boolean;
  defaultAvatar: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function ProfileEditCard({ formData, submitting, defaultAvatar, onInputChange, onSubmit, onCancel }: ProfileEditCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
      <div className="flex justify-between items-center pb-6 border-b border-slate-100 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Chỉnh sửa thông tin cá nhân</h2>
          <p className="text-sm text-slate-500 mt-0.5">Cập nhật ảnh đại diện và các thông tin hồ sơ của bạn</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          title="Đóng"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-4">
          <img
            src={formData.avatar_url || defaultAvatar}
            alt="Avatar Preview"
            className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).src = defaultAvatar; }}
          />
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              URL Ảnh đại diện
            </label>
            <input
              type="url"
              name="avatar_url"
              value={formData.avatar_url}
              onChange={onInputChange}
              placeholder="https://example.com/avatar.jpg"
              className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition bg-white"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tên tài khoản (Username)</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={onInputChange}
              required
              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ngày sinh</label>
            <input
              type="date"
              name="birthdate"
              value={formData.birthdate}
              onChange={onInputChange}
              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Giới thiệu / Tiểu sử</label>
          <textarea
            name="bio"
            rows={4}
            value={formData.bio}
            onChange={onInputChange}
            placeholder="Chia sẻ đôi điều về bản thân bạn..."
            className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition resize-none"
          />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            )}
            {submitting ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProfileDetailCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 p-4 border border-slate-200/80 rounded-2xl bg-white shadow-xs">
      <div className="p-2.5 rounded-xl bg-blue-50/80 shrink-0">
        {icon}
      </div>
      <div>
        <span className="text-xs font-medium text-slate-400 block">{label}</span>
        <span className="text-sm font-semibold text-slate-900 mt-0.5 block">{value}</span>
      </div>
    </div>
  );
}

function StatCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center shadow-xs hover:shadow-md transition duration-200">
      <h3 className="text-3xl font-bold text-blue-600">{title}</h3>
      <p className="text-slate-500 mt-2 font-medium text-sm">{text}</p>
    </div>
  );
}

interface CourseProgressCardProps {
  courseId: string | number;
  title: string;
  progress: number;
  onContinue: (id: string | number) => void;
}

function CourseProgressCard({ title, progress, courseId, onContinue }: CourseProgressCardProps) {
  return (
    <div className="border border-slate-200 rounded-xl p-5">
      <div className="flex justify-between mb-3">
        <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
        <span className="font-semibold text-blue-600">{progress}%</span>
      </div>
      <div className="w-full bg-slate-100 h-2 rounded-full">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <button
        type="button"
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md font-medium transition cursor-pointer"
        onClick={() => onContinue(courseId)}
      >
        Tiếp tục học
      </button>
    </div>
  );
}

interface CompletedCourseProps {
  courseId: string | number;
  title: string;
  onReview: (id: string | number) => void;
}

function CompletedCourse({ courseId, title, onReview }: CompletedCourseProps) {
  return (
    <div className="flex justify-between items-center border border-slate-200 rounded-lg p-4 hover:shadow-sm transition">
      <span className="font-semibold text-slate-900">{title}</span>
      <button
        type="button"
        onClick={() => onReview(courseId)}
        className="bg-slate-100 hover:bg-slate-200 text-blue-600 font-medium px-4 py-2 rounded-lg text-sm transition cursor-pointer"
      >
        Xem lại
      </button>
    </div>
  );
}

function CertificateCard({ title, date }: { title: string; date: string }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1">Ngày cấp: {date}</p>
      <div className="flex gap-2 mt-4">
        <button className="flex-1 border border-blue-600 text-blue-600 py-2 rounded-md hover:bg-blue-50 transition cursor-pointer">
          Xem
        </button>
        <button className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition cursor-pointer">
          Tải PDF
        </button>
      </div>
    </div>
  );
}