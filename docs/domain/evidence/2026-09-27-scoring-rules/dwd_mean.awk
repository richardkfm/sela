# Per-pixel 2016-2025 mean; a pixel counts only when all ten years are != -999.
FNR==1 { f++ ; i=0 }
{ for (k=1;k<=NF;k++) { i++; if ($k != -999) { s[i]+=$k; c[i]++ } } }
END {
  full=0; partial=0; none=0
  for (j=1;j<=i;j++) {
    if (c[j]==10) { full++; printf "%d\t%.4f\n", j, s[j]/10 > "mean_2016_2025.tsv" }
    else if (c[j]>0) partial++; else none++
  }
  print "pixels total", i, "all-10-valid", full, "partial", partial, "all-nodata", none
}
