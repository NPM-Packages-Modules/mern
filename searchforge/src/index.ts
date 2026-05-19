export const searchforgeEscapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
export const searchforgeFuzzyClause = (field: string, term: string) => ({[field]:{$regex:new RegExp(searchforgeEscapeRegex(term),"i")}});
export const searchforgeText = (term: string, p: string) => ({$text:{$search:term,$language:"en",$path:p}});
