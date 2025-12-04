import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Video, Shield, Lock, Mail, Hash, Phone } from "lucide-react";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  registerNumber: z.string().min(3, "Register number is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
});

const loginSchema = z.object({
  identifier: z.string().min(1, "Please enter your email, register number, or phone"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginMethod = "email" | "register" | "phone";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");
  const [ phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const getPlaceholder = () => {
    switch (loginMethod) {
      case "email": return "your.email@aicte.edu";
      case "register": return "REG123456";
      case "phone": return "9876543210";
    }
  };

  const getInputType = () => {
    switch (loginMethod) {
      case "email": return "email";
      case "phone": return "tel";
      default: return "text";
    }
  };

  const handleLogin = async () => {
    try {
      loginSchema.parse({ identifier, password });

      let userEmail = identifier;

      // If not logging in with email, lookup the email from profiles
      if (loginMethod !== "email") {
        const column = loginMethod === "register" ? "register_number" : "phone_number";
        
        const { data: profile, error: lookupError } = await supabase
          .from("profiles")
          .select("email")
          .eq(column, identifier)
          .single();

        if (lookupError || !profile) {
          throw new Error(`No account found with this ${loginMethod === "register" ? "register number" : "phone number"}`);
        }

        userEmail = profile.email;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleSignup = async () => {
    try {
      signupSchema.parse({ email, password, fullName, registerNumber, phoneNumber });

      // Check if register number or phone already exists
      const { data: existingReg } = await supabase
        .from("profiles")
        .select("id")
        .eq("register_number", registerNumber)
        .maybeSingle();

      if (existingReg) {
        throw new Error("This register number is already in use");
      }

      const { data: existingPhone } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", phoneNumber)
        .maybeSingle();

      if (existingPhone) {
        throw new Error("This phone number is already in use");
      }

      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;

      // Insert the profile with register_number and phone_number
      if (authData.user) {
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: authData.user.id,
            email: email,
            full_name: fullName,
            register_number: registerNumber,
            phone_number: phoneNumber,
          });

        if (insertError) {
          console.error("Error inserting profile:", insertError);
        }
      }

      toast({
        title: "Account created!",
        description: "You can now log in to your account.",
      });
      setIsLogin(true);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await handleLogin();
      } else {
        await handleSignup();
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIdentifier("");
    setEmail("");
    setPassword("");
    setFullName("");
    setRegisterNumber("");
    setPhoneNumber("");
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        <div className="text-center md:text-left space-y-6">
          <div className="flex items-center justify-center md:justify-start gap-3">
            <div className="bg-gradient-primary p-3 rounded-xl shadow-medium">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">AICTE Meetings</h1>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
            Secure Video Conferencing for Educational Excellence
          </h2>
          <p className="text-lg text-muted-foreground">
            Connect with stakeholders across institutes, faculties, and ministries with end-to-end encryption
          </p>
          <div className="grid gap-4 pt-4">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold text-foreground">Military-Grade Security</h3>
                <p className="text-sm text-muted-foreground">End-to-end encrypted meetings and data storage</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="w-6 h-6 text-secondary mt-1" />
              <div>
                <h3 className="font-semibold text-foreground">Role-Based Access</h3>
                <p className="text-sm text-muted-foreground">Granular permissions for administrators and participants</p>
              </div>
            </div>
          </div>
        </div>

        <Card className="shadow-large border-border">
          <CardHeader>
            <CardTitle className="text-2xl">
              {isLogin ? "Sign In" : "Create Account"}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Sign in using your email, register number, or phone"
                : "Fill in your details to get started"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isLogin ? (
                <>
                  <Tabs value={loginMethod} onValueChange={(v) => { setLoginMethod(v as LoginMethod); setIdentifier(""); }}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="email" className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <span className="hidden sm:inline">Email</span>
                      </TabsTrigger>
                      <TabsTrigger value="register" className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        <span className="hidden sm:inline">Reg No.</span>
                      </TabsTrigger>
                      <TabsTrigger value="phone" className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span className="hidden sm:inline">Phone</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="space-y-2">
                    <Label htmlFor="identifier">
                      {loginMethod === "email" ? "Email" : loginMethod === "register" ? "Register Number" : "Phone Number"}
                    </Label>
                    <Input
                      id="identifier"
                      type={getInputType()}
                      placeholder={getPlaceholder()}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@aicte.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="registerNumber">Register Number</Label>
                      <Input
                        id="registerNumber"
                        type="text"
                        placeholder="REG123456"
                        value={registerNumber}
                        onChange={(e) => setRegisterNumber(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder="9876543210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setIsLogin(!isLogin); resetForm(); }}
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
