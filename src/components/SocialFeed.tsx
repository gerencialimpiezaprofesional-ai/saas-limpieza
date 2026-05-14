import React, { useState, useEffect } from "react";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Send, 
  MoreHorizontal, 
  Trophy, 
  Zap, 
  Award,
  Loader2,
  Camera,
  Image as ImageIcon
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  increment
} from "firebase/firestore";
import { db } from "../firebase";
import { cn } from "../lib/utils";
import { toast } from "sonner";

interface Post {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userRole: string;
  content: string;
  image?: string;
  likes: string[];
  comments: Comment[];
  type?: 'achievement' | 'standard' | 'announcement';
  createdAt: any;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: any;
}

export default function SocialFeed({ userData }: { userData: any }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userData?.tenantId) return;

    const q = query(
      collection(db, "posts"),
      where("tenantId", "==", userData.tenantId),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching posts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.tenantId]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || submitting) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, "posts"), {
        userId: userData.uid,
        userName: userData.name || "Usuario",
        userPhoto: userData.lastSelfie || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.email}`,
        userRole: userData.role,
        content: newPostContent,
        likes: [],
        comments: [],
        type: 'standard',
        tenantId: userData.tenantId,
        createdAt: serverTimestamp(),
      });
      setNewPostContent("");
      toast.success("¡Publicado en el muro!");
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Error al publicar.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (post: Post) => {
    const isLiked = (post.likes || []).includes(userData.uid);
    const postRef = doc(db, "posts", post.id);

    try {
      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(userData.uid) : arrayUnion(userData.uid)
      });
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <Loader2 className="w-8 h-8 text-secondary animate-spin" />
        <p className="text-primary/40 font-bold uppercase tracking-widest text-[10px]">Conectando con el equipo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-10">
      <section className="space-y-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black font-headline text-white tracking-tight uppercase">Comunidad Impeccable</h1>
          <p className="text-xs text-primary/60 font-medium">Reconocimiento y Colaboración el Tiempo Real</p>
        </div>

        {/* Create Post Card */}
        <div className="glass-panel p-4 rounded-[2rem] border border-white/5 space-y-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-white/10 overflow-hidden shrink-0">
              <img 
                src={userData.lastSelfie || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.email}`} 
                alt="Me" 
                className="w-full h-full object-cover"
              />
            </div>
            <textarea 
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder={`¿Qué tienes en mente, ${userData.name?.split(' ')[0]}?`}
              className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-primary/30 resize-none min-h-[60px] pt-2"
            />
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-white/5">
            <div className="flex gap-2">
              <button className="p-2 hover:bg-white/5 rounded-lg text-primary/40 transition-colors">
                <ImageIcon className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-white/5 rounded-lg text-primary/40 transition-colors">
                <Camera className="w-5 h-5" />
              </button>
            </div>
            <button 
              onClick={handleCreatePost}
              disabled={!newPostContent.trim() || submitting}
              className="bg-secondary text-on-secondary px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Publicar
            </button>
          </div>
        </div>
      </section>

      {/* Posts List */}
      <section className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="glass-panel p-5 rounded-[2rem] border border-white/5 space-y-4 transition-all hover:border-white/10">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 border border-white/10 overflow-hidden shrink-0">
                  <img src={post.userPhoto} alt={post.userName} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">{post.userName}</h4>
                    {post.type === 'achievement' && <Award className="w-3 h-3 text-secondary" />}
                  </div>
                  <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest leading-none mt-0.5">
                    {post.userRole} • {new Date(post.createdAt?.seconds * 1000 || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <button className="p-1.5 text-primary/30 hover:text-white">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-3">
              <p className={cn(
                "text-sm leading-relaxed",
                post.type === 'achievement' ? "text-secondary font-medium" : "text-primary/80"
              )}>
                {post.content}
              </p>
              {post.image && (
                <div className="rounded-2xl overflow-hidden border border-white/5">
                  <img src={post.image} alt="Post content" className="w-full aspect-video object-cover" />
                </div>
              )}
            </div>

            {/* Interaction Bar */}
            <div className="flex items-center gap-6 pt-4 border-t border-white/5">
              <button 
                onClick={() => toggleLike(post)}
                className={cn(
                  "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors",
                  (post.likes || []).includes(userData.uid) ? "text-secondary" : "text-primary/40 hover:text-white"
                )}
              >
                <Heart className={cn("w-4 h-4", (post.likes || []).includes(userData.uid) && "fill-secondary")} />
                {(post.likes || []).length > 0 ? (post.likes || []).length : "Me gusta"}
              </button>
              <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/40 hover:text-white transition-colors">
                <MessageCircle className="w-4 h-4" />
                {post.comments?.length || "Comentar"}
              </button>
              <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/40 hover:text-white transition-colors ml-auto">
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {posts.length === 0 && (
          <div className="text-center py-20 opacity-30 space-y-4">
            <Zap className="w-12 h-12 mx-auto" strokeWidth={1} />
            <p className="text-xs uppercase font-black tracking-widest">Aún no hay actividad en el muro</p>
          </div>
        )}
      </section>
    </div>
  );
}
