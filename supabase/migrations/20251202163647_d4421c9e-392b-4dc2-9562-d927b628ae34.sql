-- Add register_number and phone_number columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS register_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_register_number ON public.profiles(register_number);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);