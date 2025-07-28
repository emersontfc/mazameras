
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";
import { LogOut, BookUser, Eye, BookHeart, HeartHandshake, Loader2, Trash2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Chapter {
  id: string;
  title: string;
  author: string;
  content: string;
  lastUpdated: string;
  type: 'chapter' | 'experience';
}

export default function AdminDashboardPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const currentAuthor = localStorage.getItem("currentAuthor");
    if (!currentAuthor || currentAuthor.toLowerCase() !== "super admin") {
      toast({
          title: "Acesso Negado",
          description: "Você não tem permissão para aceder a esta página.",
          variant: "destructive",
      });
      router.push("/");
    } else {
        setAuthLoading(false);
    }
  }, [router, toast]);
  
  useEffect(() => {
      if (authLoading) return;

      const fetchChapters = async () => {
        try {
          setLoading(true);
          const q = query(collection(db, "medbook-chapters"), orderBy("lastUpdated", "desc"));
          const querySnapshot = await getDocs(q);
          const allChapters: Chapter[] = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
          } as Chapter));
          setChapters(allChapters);
        } catch (error) {
          console.error("Failed to load chapters:", error);
          toast({
            title: "Erro",
            description: "Não foi possível carregar os capítulos.",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      };

      fetchChapters();
  }, [authLoading, toast]);

  const handleLogout = () => {
    localStorage.removeItem("currentAuthor");
    router.push("/");
  };

  const handleDelete = async (chapterId: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "medbook-chapters", chapterId));
      toast({
        title: "Conteúdo Excluído",
        description: "O item foi removido com sucesso.",
        className: "bg-primary text-primary-foreground"
      });
      // Refresh the list after deletion
      setChapters(prevChapters => prevChapters.filter(chapter => chapter.id !== chapterId));
    } catch (error) {
      console.error("Failed to delete chapter:", error);
      toast({
        title: "Erro ao Excluir",
        description: "Não foi possível remover o conteúdo.",
        variant: "destructive",
      });
    } finally {
        setIsDeleting(false);
    }
  }

  const handleCopy = async (chapter: Chapter) => {
    try {
      const formattedText = `Título: ${chapter.title}\nAutor: ${chapter.author}\n\n${chapter.content}`;
      await navigator.clipboard.writeText(formattedText);
      toast({
        title: "Conteúdo Copiado!",
        description: "O conteúdo foi copiado para a área de transferência.",
        className: "bg-primary text-primary-foreground",
      });
    } catch (error) {
      console.error("Failed to copy text: ", error);
      toast({
        title: "Erro ao Copiar",
        description: "Não foi possível copiar o conteúdo.",
        variant: "destructive",
      });
    }
  };
  
  if (authLoading) {
     return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <header className="p-4 border-b border-border">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo className="h-8 w-8 sm:h-10 sm:w-10" />
            <h1 className="text-lg sm:text-2xl font-headline font-bold text-foreground">Mazameras Collab - Admin</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
             <span className="hidden sm:inline text-sm text-muted-foreground">Bem-vindo(a), Super Admin</span>
             <Button onClick={handleLogout} variant="ghost" size="sm">
                <LogOut className="mr-0 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
             </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 lg:p-8">
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-headline">Todo o Conteúdo</h2>
            </div>
            {loading ? (
                 <div className="flex justify-center items-center p-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                 </div>
            ) : chapters.length > 0 ? (
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {chapters.map(chapter => (
                        <Card key={chapter.id} className="shadow-sm hover:shadow-md transition-shadow flex flex-col">
                            <CardHeader>
                                <div className="flex justify-between items-start gap-2">
                                    <CardTitle className="text-xl mb-1">{chapter.title || "Sem título"}</CardTitle>
                                    <Badge variant={chapter.type === 'experience' ? 'secondary' : 'default'} className="capitalize whitespace-nowrap text-xs">
                                        {chapter.type === 'experience' ? <HeartHandshake className="mr-1.5 h-3 w-3" /> : <BookHeart className="mr-1.5 h-3 w-3" />}
                                        {chapter.type === 'chapter' ? 'Capítulo' : 'Experiência'}
                                    </Badge>
                                </div>
                                <CardDescription>Por: {chapter.author}</CardDescription>
                                <CardDescription>Última actualização: {new Date(chapter.lastUpdated).toLocaleString()}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="line-clamp-4 text-muted-foreground mb-4">
                                    {chapter.content || "Nenhum conteúdo ainda..."}
                                </p>
                            </CardContent>
                            <div className="p-6 pt-0 flex flex-wrap items-center justify-between gap-2">
                               <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => router.push(`/editor/${chapter.id}`)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Ver / Editar
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleCopy(chapter)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copiar
                                </Button>
                               </div>
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Excluir
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Tem a certeza?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acção não pode ser desfeita. Isto irá excluir permanentemente o conteúdo do banco de dados.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={() => handleDelete(chapter.id)}
                                                disabled={isDeleting}
                                                className="bg-destructive hover:bg-destructive/90"
                                            >
                                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Sim, excluir
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="text-center p-8 sm:p-12 border-dashed col-span-full">
                    <BookUser className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <CardTitle className="mb-2 text-xl sm:text-2xl">Nenhum conteúdo foi escrito ainda</CardTitle>
                    <CardDescription>Quando os autores começarem a escrever, o conteúdo aparecerá aqui.</CardDescription>
                </Card>
            )}
        </div>
      </main>
    </div>
  );
}
