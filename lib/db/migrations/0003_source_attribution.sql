-- docs/data/sources.md §7 condition 4: "The source's required attribution
-- string is implemented in the interface and in every export before the data
-- reaches a public screen — not added later."
--
-- Storing the licence label was never enough. `dl-de/by-2-0`, GeoNutzV and
-- CC BY 4.0 each demand a *specific* Quellenvermerk, and publishers differ on
-- it even within one organisation: BKG's CLC5 requires
-- "© GeoBasis-DE / BKG <Jahr>" while the same agency's VG25 requires
-- "© BKG <Jahr>". A renderer cannot derive either from the word
-- "dl-de/by-2-0", so the exact text belongs with the source row.
--
-- `attribution` is NOT NULL with a non-empty CHECK on purpose. The binding
-- rule in design-language.md §7 is "a card that cannot cite itself must not
-- render"; making the notice structurally required means an uncitable source
-- cannot be inserted in the first place, rather than failing at render time
-- on somebody's screenshot.

ALTER TABLE source ADD COLUMN attribution text;
ALTER TABLE source ADD COLUMN attribution_url text;
ALTER TABLE source ADD COLUMN change_notice_required boolean NOT NULL DEFAULT true;

-- Existing rows predate this column. Rather than invent a notice for them,
-- they are marked as uncitable in so many words — anything rendering them
-- will say so instead of showing a plausible-looking credit nobody verified.
UPDATE source
   SET attribution = 'Quellenvermerk nicht hinterlegt — Quelle nicht zitierfähig'
 WHERE attribution IS NULL;

ALTER TABLE source ALTER COLUMN attribution SET NOT NULL;
ALTER TABLE source ADD CONSTRAINT source_attribution_not_blank
  CHECK (length(btrim(attribution)) > 0);

COMMENT ON COLUMN source.attribution IS
  'The exact Quellenvermerk this publisher requires, verbatim, with <Jahr> '
  'left as a placeholder where the licence asks for the year of last data '
  'retrieval. Verified per product, never inferred from the licence family — '
  'see docs/data/sources.md §3.';

COMMENT ON COLUMN source.attribution_url IS
  'Where the licence text requires the notice to be hyperlinked (dl-de/by-2-0 '
  'and CC BY 4.0 both do, on a web page), the target URL. NULL means the '
  'publisher asks for no link, not that the link was forgotten.';

COMMENT ON COLUMN source.change_notice_required IS
  'True where the licence demands a Veränderungshinweis for altered data. '
  'Defaults true because every sela criterion_value is an alteration: GeoNutzV '
  '§3, dl-de/by-2-0 §1(3) and CC BY 4.0 all require it, and the BKG CLC5 '
  'archive says so in its own words ("(Daten verändert)").';
