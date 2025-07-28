
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";
import { LogIn, Loader2, HeartPulse } from "lucide-react";

export default function LoginPage() {
  const [authorName, setAuthorName] = useState("");
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const currentAuthor = localStorage.getItem("currentAuthor");
    if (currentAuthor) {
      if (currentAuthor.toLowerCase() === "super admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } else {
      setAuthChecked(true);
    }
  }, [router]);

  const handleLogin = () => {
    const trimmedName = authorName.trim();
    if (!trimmedName) {
      toast({
        title: "Nome Inválido",
        description: "Por favor, insira o seu nome de autor.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    localStorage.setItem("currentAuthor", trimmedName);

    setTimeout(() => {
        if (trimmedName.toLowerCase() === "super admin") {
            router.push("/admin");
        } else {
            router.push("/dashboard");
        }
    }, 500);
  };

  if (!authChecked) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 font-body">
      <div className="hidden lg:flex flex-col items-center justify-center gap-8 bg-primary text-primary-foreground p-8">
        <div className="flex items-center gap-4">
          <Logo className="h-16 w-16" />
          <h1 className="text-5xl font-bold font-headline">Mazameras Collab</h1>
        </div>
        <p className="text-xl max-w-lg text-center text-primary-foreground/80">
          Venha, faça parte da história dos mazameras. Conte como foi e como está a ser o seu percurso.
        </p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="mx-auto grid w-[380px] gap-6">
          <div className="grid gap-2 text-center">
             <div className="flex justify-center items-center gap-3 mb-2 lg:hidden">
              <Logo className="h-12 w-12" />
            </div>
            <h1 className="text-3xl font-bold font-headline">Mazameras Collab</h1>
            <p className="text-balance text-muted-foreground">
              Faça parte da história dos mazameras, conte o seu percurso.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
               <label htmlFor="author" className="font-semibold text-sm">Seu Nome de Autor(a)</label>
              <Input
                id="author"
                placeholder="Ex: Dr. Ela Vilanculos"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                onKeyUp={(e) => e.key === 'Enter' && handleLogin()}
                className="text-base h-11"
                disabled={loading}
              />
            </div>
            <Button onClick={handleLogin} size="lg" className="w-full h-11" disabled={loading || !authorName}>
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            <HeartPulse className="inline-block h-5 w-5 text-primary mr-2" />
            Um projeto para eternizar histórias.
          </div>
        </div>
      </div>
    </div>
  );
}
