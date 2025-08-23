-- Seed data for Typing RPG Game
-- Test data for development and testing

-- Insert test word packs
insert into public.word_packs (title, description, lang, level_min, level_max, tags, is_active) values
  (
    'NGSL Basic 1000', 
    'New General Service List - most common 1000 English words',
    'en', 
    1, 
    3, 
    array['general', 'basic', 'ngsl'],
    true
  ),
  (
    'TOEIC Essentials',
    'Essential vocabulary for TOEIC test preparation',
    'en',
    2,
    4,
    array['toeic', 'business', 'test-prep'],
    true
  ),
  (
    'Academic Word List',
    'Academic vocabulary for higher education',
    'en',
    3,
    5,
    array['academic', 'university', 'advanced'],
    true
  );

-- Get the pack IDs for inserting words
do $$
declare
  ngsl_pack_id uuid;
  toeic_pack_id uuid;
  academic_pack_id uuid;
begin
  -- Get pack IDs
  select id into ngsl_pack_id from public.word_packs where title = 'NGSL Basic 1000';
  select id into toeic_pack_id from public.word_packs where title = 'TOEIC Essentials';
  select id into academic_pack_id from public.word_packs where title = 'Academic Word List';

  -- Insert words for NGSL Basic pack (Level 1-2 words)
  insert into public.words (pack_id, text, level, pronunciation, meaning) values
    -- Level 1 - Very common, short words
    (ngsl_pack_id, 'the', 1, '/ðə/', 'definite article'),
    (ngsl_pack_id, 'and', 1, '/ænd/', 'conjunction: also'),
    (ngsl_pack_id, 'you', 1, '/juː/', 'pronoun: second person'),
    (ngsl_pack_id, 'that', 1, '/ðæt/', 'demonstrative pronoun'),
    (ngsl_pack_id, 'was', 1, '/wʌz/', 'past tense of be'),
    (ngsl_pack_id, 'for', 1, '/fɔːr/', 'preposition: purpose'),
    (ngsl_pack_id, 'are', 1, '/ɑːr/', 'plural form of be'),
    (ngsl_pack_id, 'with', 1, '/wɪð/', 'preposition: together'),
    (ngsl_pack_id, 'his', 1, '/hɪz/', 'possessive pronoun'),
    (ngsl_pack_id, 'they', 1, '/ðeɪ/', 'third person plural pronoun'),
    
    -- Level 2 - Common, slightly longer words
    (ngsl_pack_id, 'have', 2, '/hæv/', 'verb: to possess'),
    (ngsl_pack_id, 'this', 2, '/ðɪs/', 'demonstrative pronoun'),
    (ngsl_pack_id, 'will', 2, '/wɪl/', 'modal verb: future'),
    (ngsl_pack_id, 'your', 2, '/jɔːr/', 'possessive adjective'),
    (ngsl_pack_id, 'from', 2, '/frʌm/', 'preposition: origin'),
    (ngsl_pack_id, 'there', 2, '/ðɛr/', 'adverb: location'),
    (ngsl_pack_id, 'been', 2, '/bɪn/', 'past participle of be'),
    (ngsl_pack_id, 'time', 2, '/taɪm/', 'noun: duration'),
    (ngsl_pack_id, 'very', 2, '/vɛri/', 'adverb: extremely'),
    (ngsl_pack_id, 'when', 2, '/wɛn/', 'adverb: at what time'),
    
    -- Level 3 - More complex words
    (ngsl_pack_id, 'people', 3, '/piːpəl/', 'noun: human beings'),
    (ngsl_pack_id, 'think', 3, '/θɪŋk/', 'verb: to consider'),
    (ngsl_pack_id, 'other', 3, '/ʌðər/', 'adjective: different'),
    (ngsl_pack_id, 'after', 3, '/æftər/', 'preposition: following'),
    (ngsl_pack_id, 'first', 3, '/fɜːrst/', 'ordinal number: 1st'),
    (ngsl_pack_id, 'well', 3, '/wɛl/', 'adverb: in a good way'),
    (ngsl_pack_id, 'work', 3, '/wɜːrk/', 'noun/verb: labor'),
    (ngsl_pack_id, 'life', 3, '/laɪf/', 'noun: existence'),
    (ngsl_pack_id, 'only', 3, '/oʊnli/', 'adverb: exclusively'),
    (ngsl_pack_id, 'new', 3, '/nuː/', 'adjective: recent');

  -- Insert words for TOEIC Essentials pack (Level 2-4 words)
  insert into public.words (pack_id, text, level, meaning) values
    -- Level 2 - Basic business terms
    (toeic_pack_id, 'business', 2, 'commercial enterprise'),
    (toeic_pack_id, 'company', 2, 'commercial organization'),
    (toeic_pack_id, 'office', 2, 'workplace building'),
    (toeic_pack_id, 'meeting', 2, 'formal gathering'),
    (toeic_pack_id, 'project', 2, 'planned undertaking'),
    
    -- Level 3 - Intermediate business vocabulary  
    (toeic_pack_id, 'schedule', 3, 'planned timetable'),
    (toeic_pack_id, 'deadline', 3, 'time limit for completion'),
    (toeic_pack_id, 'budget', 3, 'financial plan'),
    (toeic_pack_id, 'client', 3, 'customer or patron'),
    (toeic_pack_id, 'report', 3, 'formal account'),
    (toeic_pack_id, 'contract', 3, 'legal agreement'),
    (toeic_pack_id, 'invoice', 3, 'bill for goods/services'),
    (toeic_pack_id, 'profit', 3, 'financial gain'),
    (toeic_pack_id, 'market', 3, 'commercial environment'),
    (toeic_pack_id, 'training', 3, 'skill development'),
    
    -- Level 4 - Advanced business terms
    (toeic_pack_id, 'negotiation', 4, 'discussion to reach agreement'),
    (toeic_pack_id, 'implementation', 4, 'putting into effect'),
    (toeic_pack_id, 'productivity', 4, 'efficiency of production'),
    (toeic_pack_id, 'conference', 4, 'formal meeting'),
    (toeic_pack_id, 'investment', 4, 'money put into business');

  -- Insert words for Academic Word List pack (Level 3-5 words)
  insert into public.words (pack_id, text, level, meaning) values
    -- Level 3 - Basic academic terms
    (academic_pack_id, 'analysis', 3, 'detailed examination'),
    (academic_pack_id, 'approach', 3, 'method of dealing with'),
    (academic_pack_id, 'concept', 3, 'abstract idea'),
    (academic_pack_id, 'create', 3, 'bring into existence'),
    (academic_pack_id, 'data', 3, 'facts and statistics'),
    
    -- Level 4 - Intermediate academic vocabulary
    (academic_pack_id, 'establish', 4, 'set up or found'),
    (academic_pack_id, 'evidence', 4, 'proof or support'),
    (academic_pack_id, 'factor', 4, 'contributing element'),
    (academic_pack_id, 'function', 4, 'purpose or role'),
    (academic_pack_id, 'identify', 4, 'recognize or determine'),
    (academic_pack_id, 'indicate', 4, 'point out or show'),
    (academic_pack_id, 'method', 4, 'systematic procedure'),
    (academic_pack_id, 'occur', 4, 'happen or take place'),
    (academic_pack_id, 'percent', 4, 'proportion per hundred'),
    (academic_pack_id, 'research', 4, 'systematic investigation'),
    
    -- Level 5 - Advanced academic terms
    (academic_pack_id, 'constitute', 5, 'form or compose'),
    (academic_pack_id, 'hypothesis', 5, 'proposed explanation'),
    (academic_pack_id, 'interpret', 5, 'explain meaning of'),
    (academic_pack_id, 'paradigm', 5, 'model or framework'),
    (academic_pack_id, 'parameters', 5, 'defining characteristics'),
    (academic_pack_id, 'phenomenon', 5, 'observable occurrence'),
    (academic_pack_id, 'significant', 5, 'important or meaningful'),
    (academic_pack_id, 'structure', 5, 'arrangement of parts'),
    (academic_pack_id, 'subsequent', 5, 'following in time'),
    (academic_pack_id, 'theoretical', 5, 'based on theory');

end $$;

-- Add some comments
comment on table public.word_packs is 'Word packs are collections of words grouped by theme, difficulty, or source (NGSL, TOEIC, etc.)';
comment on table public.words is 'Individual words with metadata like level, pronunciation, and meaning for the typing game';

-- Display summary of inserted data
select 
  wp.title as pack_title,
  wp.level_min,
  wp.level_max,
  count(w.*) as word_count,
  count(w.*) filter (where w.level = 1) as level_1_count,
  count(w.*) filter (where w.level = 2) as level_2_count,  
  count(w.*) filter (where w.level = 3) as level_3_count,
  count(w.*) filter (where w.level = 4) as level_4_count,
  count(w.*) filter (where w.level = 5) as level_5_count
from public.word_packs wp
left join public.words w on w.pack_id = wp.id
group by wp.id, wp.title, wp.level_min, wp.level_max
order by wp.title;