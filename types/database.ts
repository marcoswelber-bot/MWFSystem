export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "adm_master" | "clinic_admin" | "staff";

export type Database = {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string;
          name: string;
          slug: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          clinic_id: string | null;
          full_name: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          clinic_id?: string | null;
          full_name: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          full_name?: string;
          role?: UserRole;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
