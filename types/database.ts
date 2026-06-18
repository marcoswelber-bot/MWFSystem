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
          slug: string | null;
          active: boolean | null;
          phone: string | null;
          whatsapp: string | null;
          email: string | null;
          cnpj: string | null;
          address: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          active?: boolean | null;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          cnpj?: string | null;
          address?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          active?: boolean | null;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          cnpj?: string | null;
          address?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          clinic_id: string | null;
          name: string;
          phone: string | null;
          whatsapp: string | null;
          email: string | null;
          role: string | null;
          commission_type: string | null;
          commission_value: number | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          name: string;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          role?: string | null;
          commission_type?: string | null;
          commission_value?: number | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          name?: string;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          role?: string | null;
          commission_type?: string | null;
          commission_value?: number | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          clinic_id: string | null;
          name: string;
          type: string | null;
          price: number | null;
          duration_minutes: number | null;
          allows_package: boolean;
          commission_type: string | null;
          commission_value: number | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          name: string;
          type?: string | null;
          price?: number | null;
          duration_minutes?: number | null;
          allows_package?: boolean;
          commission_type?: string | null;
          commission_value?: number | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          name?: string;
          type?: string | null;
          price?: number | null;
          duration_minutes?: number | null;
          allows_package?: boolean;
          commission_type?: string | null;
          commission_value?: number | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      medical_records: {
        Row: {
          id: string;
          patient_id: string | null;
          employee_id: string | null;
          title: string;
          complaint: string | null;
          history: string | null;
          conduct: string | null;
          evolution: string | null;
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id?: string | null;
          employee_id?: string | null;
          title: string;
          complaint?: string | null;
          history?: string | null;
          conduct?: string | null;
          evolution?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string | null;
          employee_id?: string | null;
          title?: string;
          complaint?: string | null;
          history?: string | null;
          conduct?: string | null;
          evolution?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
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
      patients: {
        Row: {
          id: string;
          clinic_id: string | null;
          full_name: string;
          cpf: string | null;
          birth_date: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          full_name: string;
          cpf?: string | null;
          birth_date?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          full_name?: string;
          cpf?: string | null;
          birth_date?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
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
