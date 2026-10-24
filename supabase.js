
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ========================================
// CONNEXION a SUPABASE
// ========================================
const supabaseUrl = "https://chqwdeyoxxeihatnvqmy.supabase.co";
const supabaseKey = "sb_publishable_ykAX9Pnq3xrIqLhKlK4CLQ_g2rK9a1B";
export const supabase = createClient(supabaseUrl, supabaseKey);






