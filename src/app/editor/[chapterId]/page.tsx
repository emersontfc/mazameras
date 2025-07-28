
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, addDoc, collection } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";
import { Save, Send, Loader2, ArrowLeft } from "lucide-react";

type SaveStatus = "unsaved" | "saving" | "saved" | "error";
type ContentType = 'chapter' | 'experience';

interface Chapter {
  id?: string;
  title: string;
  author: string;
  content: string;
  lastUpdated: string;
  type: ContentType;
}

export default function EditorPage() {
  const [author, setAuthor] = useState("");
  const [chapterAuthor, setChapterAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<ContentType>('chapter');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isMounted, setIsMounted] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isNewDoc, setIsNewDoc] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const docIdRef = useRef<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const chapterIdParam = params.chapterId as string;

  const wordCount = useMemo(() => {
    if (!content) return 0;
    const words = content.trim().split(/\s+/);
    return words.filter(word => word.length > 0).length;
  }, [content]);

  useEffect(() => {
    setIsMounted(true);
    const currentAuthor = localStorage.getItem("currentAuthor");
    if (!currentAuthor) {
      router.push("/");
      return;
    }
    
    setAuthor(currentAuthor);
    setIsSuperAdmin(currentAuthor.toLowerCase() === 'super admin');

    const isCreatingNew = chapterIdParam.endsWith('_new');
    setIsNewDoc(isCreatingNew);
    const typeFromId = chapterIdParam.startsWith('experience') ? 'experience' : 'chapter';
    setContentType(typeFromId);

    if (isCreatingNew) {
        setChapterAuthor(currentAuthor);
        setIsLoading(false);
        setSaveStatus("saved");
    } else {
        docIdRef.current = chapterIdParam;
        const fetchChapter = async () => {
            try {
                const docRef = doc(db, "medbook-chapters", chapterIdParam);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const chapterData = docSnap.data() as Chapter;
                    // Super admin can edit anyone's content, otherwise check author
                    if (chapterData.author !== currentAuthor && !currentAuthor.toLowerCase().includes('super admin')) {
                        toast({ title: "Acesso Negado", description: "Você não pode editar o conteúdo de outro autor.", variant: "destructive" });
                        router.push('/dashboard');
                        return;
                    }
                    setTitle(chapterData.title || "");
                    setContent(chapterData.content || "");
                    setChapterAuthor(chapterData.author);
                    setContentType(chapterData.type);
                } else {
                    toast({ title: "Não Encontrado", description: "O conteúdo que você está tentando editar não existe.", variant: "destructive"});
                    router.push(isSuperAdmin ? '/admin' : '/dashboard');
                }
            } catch (error) {
                console.error("Fetch error:", error)
                toast({ title: "Erro ao Carregar", description: "Não foi possível carregar o conteúdo.", variant: "destructive"});
                router.push(isSuperAdmin ? '/admin' : '/dashboard');
            } finally {
                setIsLoading(false);
            }
        };
        fetchChapter();
    }
  }, [chapterIdParam, router, toast]);

  const handleSave = useCallback(async () => {
    if (!isMounted || !author) return;
    setSaveStatus("saving");

    try {
      const chapterData: Chapter = {
        author: chapterAuthor || author,
        title: title,
        content: content,
        lastUpdated: new Date().toISOString(),
        type: contentType,
      };
      
      let currentDocId = docIdRef.current;

      if (isNewDoc && !currentDocId) {
        const docRef = await addDoc(collection(db, "medbook-chapters"), chapterData);
        docIdRef.current = docRef.id;
        currentDocId = docRef.id;
        setIsNewDoc(false); 
        router.replace(`/editor/${docRef.id}`, { scroll: false }); 
      } else if (currentDocId) {
        const docRef = doc(db, "medbook-chapters", currentDocId);
        await setDoc(docRef, chapterData, { merge: true });
      }
      
      setSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save chapter:", error);
      setSaveStatus("error");
      toast({
        title: "Erro ao Salvar",
        description: "Não foi possível salvar suas alterações. Verifique a consola.",
        variant: "destructive"
      });
    }
  }, [isMounted, author, chapterAuthor, title, content, contentType, isNewDoc, router, toast]);
  
  useEffect(() => {
    if (isLoading || !isMounted) return;

    setSaveStatus("unsaved");
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    debounceTimer.current = setTimeout(() => {
        if(isNewDoc && !title && !content) {
            setSaveStatus("saved");
            return;
        }
        handleSave();
    }, 1500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [title, content, handleSave, isNewDoc, isLoading, isMounted]);

  const handleSubmit = async () => {
    if (!title || !content) {
      toast({
        title: "Conteúdo Incompleto",
        description: "Por favor, preencha o título e o conteúdo.",
        variant: "destructive",
      });
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    await handleSave();
    toast({
      title: "Conteúdo Enviado!",
      description: "Obrigado pela sua contribuição.",
      className: "bg-primary text-primary-foreground"
    });
    router.push(isSuperAdmin ? '/admin' : '/dashboard');
  };
  
  const handleBack = () => {
    router.push(isSuperAdmin ? '/admin' : '/dashboard');
  }

  const SaveStatusIndicator = () => {
    let icon;
    let text;
    switch (saveStatus) {
      case "saving":
        icon = <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
        text = "Salvando...";
        break;
      case "saved":
        icon = <Save className="h-4 w-4 text-primary" />;
        text = "Salvo";
        break;
      case "error":
         icon = <Save className="h-4 w-4 text-destructive" />;
         text = "Erro ao salvar";
         break;
      case "unsaved":
      default:
        icon = <Save className="h-4 w-4 text-muted-foreground" />;
        text = "Alterações não salvas";
        break;
    }
    return <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}<span>{text}</span></div>;
  };

  if (isLoading || !isMounted) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  const pageTitle = isNewDoc ? (contentType === 'chapter' ? 'Escreva um Novo Capítulo' : 'Escreva uma Nova Experiência') : 'Editando Conteúdo';
  const pageDescription = contentType === 'chapter' ? 'Sua contribuição para "A Vida de um Estudante de Medicina".' : 'Partilhe uma das suas histórias ou reflexões.';

  return (
      <div className="min-h-screen bg-background font-body text-foreground">
        <header className="p-4 border-b border-border">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <Logo className="h-8 w-8 sm:h-10 sm:w-10" />
              <h1 className="text-lg sm:text-2xl font-headline font-bold text-foreground">Mazameras Collab</h1>
            </div>
            <div className="hidden sm:block">
              <SaveStatusIndicator />
            </div>
          </div>
        </header>

        <main className="container mx-auto p-4 lg:p-8">
            <Button variant="ghost" onClick={handleBack} className="mb-4 -ml-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
            </Button>
          <div className="max-w-3xl mx-auto">
            <Card className="shadow-lg border-border">
              <CardHeader>
                <CardTitle className="font-headline text-2xl sm:text-3xl">{pageTitle}</CardTitle>
                <CardDescription>{pageDescription} Autor: {chapterAuthor || author}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="title" className="font-semibold">Título</label>
                  <Input id="title" placeholder={contentType === 'chapter' ? "Ex: Chumbei 4 vezes na Dra Xiluva" : "Ex: O meu primeiro paciente"} value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-headline" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="content" className="font-semibold">Conteúdo</label>
                    <span className="text-sm text-muted-foreground">{wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}</span>
                  </div>
                  <Textarea
                    id="content-textarea"
                    placeholder="Era uma vez, nos corredores movimentados do laboratório de anatomia..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[300px] sm:min-h-[400px] text-base leading-relaxed"
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                   <div className="block sm:hidden self-start">
                      <SaveStatusIndicator />
                   </div>
                   <Button onClick={handleSubmit} size="lg" className="w-full sm:w-auto" disabled={saveStatus === 'saving' || !title || !content}>
                    {saveStatus === 'saving' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                    Enviar Contribuição
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
  );
}
