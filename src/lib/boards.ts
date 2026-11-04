import { createClient } from "@/lib/supabase/client";
import type { Board, Property, PropertyNote, PropertyStatus } from "@/lib/types";

export async function getOrCreateDefaultBoard(): Promise<Board> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Try to get existing board
  const { data: boards, error: fetchError } = await supabase
    .from("boards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (fetchError) throw fetchError;

  if (boards && boards.length > 0) {
    return boards[0] as Board;
  }

  // Create default board
  const { data: newBoard, error: createError } = await supabase
    .from("boards")
    .insert({ user_id: user.id, title: "Mi búsqueda" })
    .select()
    .single();

  if (createError) throw createError;
  return newBoard as Board;
}

export async function getProperties(boardId: string): Promise<Property[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Property[];
}

export async function addProperty(property: {
  board_id: string;
  title: string;
  original_url?: string | null;
  price?: number | null;
  image_url?: string | null;
  description?: string | null;
}): Promise<Property> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("properties")
    .insert(property)
    .select()
    .single();

  if (error) throw error;
  return data as Property;
}

export async function updatePropertyStatus(
  id: string,
  status: PropertyStatus
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("properties")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

export async function addPropertyNote(
  id: string,
  content: string
): Promise<PropertyNote> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("property_notes")
    .insert({ property_id: id, content: content.trim() })
    .select("id, property_id, user_id, content, created_at")
    .single();

  if (error) throw error;
  return data as PropertyNote;
}

export async function deleteProperty(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("properties")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
