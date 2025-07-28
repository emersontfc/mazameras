
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";
import { PlusCircle, BookText, LogOut, Edit, HeartHandshake, BookHeart, Loader2 } from "lucide-react";

interface Chapter {
  id: string;
  title: string;
  author: string;
  content: string;
  lastUpdated: string;
  type: 'chapter' | 'experience';
}

export default function DashboardPage() {
  const [author, setAuthor] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [experiences, setExperiences] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const currentAuthor = localStorage.getItem("currentAuthor");
    if (!currentAuthor) {
      router.push("/");
    } else {
      setAuthor(currentAuthor);
    }
    setAuthLoading(false);
  }, [router]);

  useEffect(() => {
    if (!author) return;

    const fetchContent = async (authorName: string) => {
        try {
            setLoading(true);
            const q = query(
                collection(db, "medbook-chapters"), 
                where("author", "==", authorName)
            );
            const querySnapshot = await getDocs(q);
            const authorContent: Chapter[] = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Chapter));

            authorContent.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
            
            setChapters(authorContent.filter(c => c.type === 'chapter' || !c.type));
            setExperiences(authorContent.filter(c => c.type === 'experience'));
        } catch (error: any) {
            console.error("Failed to load content:", error);
            if (error.code === 'failed-precondition') {
                 toast({
                    title: "Índice Necessário",
                    description: "O banco de dados precisa de um índice. Por favor, contacte o administrador.",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Erro ao Carregar",
                    description: "Não foi possível carregar o seu conteúdo.",
                    variant: "destructive",
                });
            }
        } finally {
            setLoading(false);
        }
    };

    fetchContent(author);

  }, [author, toast]);

  const handleLogout = () => {
    localStorage.removeItem("currentAuthor");
    router.push("/");
  };
  
  const handleCreateNew = (type: 'chapter' | 'experience') => {
    const newContentId = `${type}_new`; 
    router.push(`/editor/${newContentId}`);
  };

  if (authLoading || !author) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  const renderContentList = (items: Chapter[], type: 'chapter' | 'experience') => {
    if (loading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (items.length === 0) {
        return (
             <Card className="text-center p-8 sm:p-12 border-dashed">
                <BookText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="mb-2 text-xl sm:text-2xl">Nenhum registo encontrado</CardTitle>
                <CardDescription className="mb-6">Parece que você ainda não escreveu nada aqui.</CardDescription>
                <Button onClick={() => handleCreateNew(type)}>
                    <PlusCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    {type === 'chapter' ? 'Escreva seu primeiro capítulo' : 'Escreva sua primeira experiência'}
                </Button>
            </Card>
        )
    }

    return (
        <div className="grid gap-6">
            {items.map(item => (
                <Card key={item.id} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle>{item.title || "Sem título"}</CardTitle>
                        <CardDescription>Última actualização: {new Date(item.lastUpdated).toLocaleString()}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="line-clamp-3 text-muted-foreground mb-4">
                            {item.content || "Nenhum conteúdo ainda..."}
                        </p>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/editor/${item.id}`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <header className="p-4 border-b border-border">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo className="h-8 w-8 sm:h-10 sm:w-10" />
            <h1 className="text-lg sm:text-2xl font-headline font-bold text-foreground">Mazameras Collab</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
             <span className="hidden sm:inline text-sm text-muted-foreground">Bem-vindo(a), {author}</span>
             <Button onClick={handleLogout} variant="ghost" size="sm">
                <LogOut className="mr-0 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
             </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-2xl sm:text-3xl font-headline">Seu Painel</h2>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button onClick={() => handleCreateNew('experience')} className="flex-1 sm:flex-none">
                        <HeartHandshake className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">Escrever </span>Experiência
                    </Button>
                    <Button onClick={() => handleCreateNew('chapter')} className="flex-1 sm:flex-none">
                        <BookHeart className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">Escrever </span>Capítulo
                    </Button>
                </div>
            </div>
            
            <Tabs defaultValue="chapters" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="chapters">Capítulos ({chapters.length})</TabsTrigger>
                <TabsTrigger value="experiences">Experiências ({experiences.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="chapters" className="mt-6">
                {renderContentList(chapters, 'chapter')}
              </TabsContent>
              <TabsContent value="experiences" className="mt-6">
                {renderContentList(experiences, 'experience')}
              </TabsContent>
            </Tabs>
        </div>
      </main>
    </div>
  );
}
