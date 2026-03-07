CREATE OR REPLACE FUNCTION public.increment_bookshelf_score(user_ids UUID[], delta INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.users SET bookshelf_score = bookshelf_score + delta WHERE id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
