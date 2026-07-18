import { supabase } from './supabaseClient';

// elder_family_comments has no direct foreign key to elder_profiles (both reference
// auth.users independently), so author display names can't be embedded in one PostgREST
// query — same reasoning as lib/family.ts's fetchFamilyLink, which does the same two-query
// pattern rather than relying on an embedded join.

export interface FamilyComment {
  id: string;
  familyUserId: string;
  familyDisplayName: string | null;
  commentText: string;
  liked: boolean;
  createdAt: string;
}

export async function fetchComments(elderUserId: string): Promise<FamilyComment[]> {
  const { data: comments, error } = await supabase
    .from('elder_family_comments')
    .select('id, family_user_id, comment_text, liked, created_at')
    .eq('elder_user_id', elderUserId)
    .order('created_at', { ascending: false });
  // Generic queries, no custom RPC business message ever involved — never trust error.message
  // verbatim (it can be a stringified native exception on a network failure, see lib/errors.ts).
  if (error) throw new Error('攞唔到留言，請再試');
  if (!comments || comments.length === 0) return [];

  const familyUserIds = [...new Set(comments.map((c: { family_user_id: string }) => c.family_user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('elder_profiles')
    .select('user_id, display_name')
    .in('user_id', familyUserIds);
  if (profilesError) throw new Error('攞唔到留言，請再試');

  const nameByUserId = new Map(
    (profiles ?? []).map((p: { user_id: string; display_name: string | null }) => [p.user_id, p.display_name]),
  );

  return comments.map((c: { id: string; family_user_id: string; comment_text: string; liked: boolean; created_at: string }) => ({
    id: c.id,
    familyUserId: c.family_user_id,
    familyDisplayName: nameByUserId.get(c.family_user_id) ?? null,
    commentText: c.comment_text,
    liked: c.liked,
    createdAt: c.created_at,
  }));
}

export async function postComment(elderUserId: string, commentText: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');

  const { error } = await supabase
    .from('elder_family_comments')
    .insert({ elder_user_id: elderUserId, family_user_id: user.id, comment_text: commentText });
  if (error) throw new Error('送出失敗，請再試');
}

export async function likeComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('elder_family_comments').update({ liked: true }).eq('id', commentId);
  if (error) throw new Error('撳讚失敗，請再試');
}
