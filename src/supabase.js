import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = "https://tnanjqalokmefltsbuom.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuYW5qcWFsb2ttZWZsdHNidW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NDU2NTAsImV4cCI6MjA5NDIyMTY1MH0.SJvrueU5g9cDrdmyOYKdgSVKQM0tP9gAqI7XAjwvlHA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/**
 * Upload a file to Supabase Storage
 * @param {File} file - the file object
 * @param {string} folder - e.g. "homework/class9/maths"
 * @returns {string} public URL
 */
export async function uploadFile(file, folder) {
  const ext      = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from("uploads")
    .upload(fileName, file, { cacheControl:"3600", upsert:false });

  if (error) throw error;

  const { data } = supabase.storage
    .from("uploads")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

/**
 * Delete a file from Supabase by its public URL
 */
export async function deleteFile(publicUrl) {
  const path = publicUrl.split("/uploads/")[1];
  if (!path) return;
  await supabase.storage.from("uploads").remove([path]);
}