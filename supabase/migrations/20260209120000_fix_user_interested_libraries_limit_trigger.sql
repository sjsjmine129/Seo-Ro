-- -----------------------------------------------------------------------------
-- 관심 도서관 개수 제한: bookshelf_score / 티어 로직 제거 후 고정 상한 8개만 적용
--
-- 과거 배포에는 BEFORE INSERT 트리거가 점수별로 허용 개수를 계산했을 수 있습니다.
-- 그 경우 INSERT 시 `P0001` + RAISE EXCEPTION 이 발생합니다.
--
-- 적용 후에도 문제가 있으면 Supabase SQL에서 확인:
--   SELECT tgname, pg_get_triggerdef(oid)
--   FROM pg_trigger WHERE tgrelid = 'public.user_interested_libraries'::regclass AND NOT tgisinternal;
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_user_interested_libraries_max
  ON public.user_interested_libraries;

CREATE OR REPLACE FUNCTION public.check_user_interested_libraries_max()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  max_allowed CONSTANT INTEGER := 8;
  v_row_count INTEGER;
BEGIN
  -- Use := (scalar subquery), not SELECT INTO — avoids parsers treating INTO as SELECT INTO table.
  v_row_count := (
    SELECT COUNT(*)::INTEGER
    FROM public.user_interested_libraries
    WHERE user_id = NEW.user_id
  );

  IF COALESCE(v_row_count, 0) >= max_allowed THEN
    RAISE EXCEPTION '관심 도서관은 최대 8개까지 등록할 수 있습니다.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_user_interested_libraries_max() IS
  '관심 도서관(user_interested_libraries) 최대 8개(BEFORE INSERT). bookshelf_score 무관.';

CREATE TRIGGER trigger_user_interested_libraries_max
  BEFORE INSERT ON public.user_interested_libraries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_user_interested_libraries_max();
