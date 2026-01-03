"""
You are building a chatbot, but unfortunately, your system has a tendency to be a bit chatty and repetitive. Your goal today is to develop a validator to check how repetitive the output is.
 
We define repetitive as follows: given a string s, find the length of the longest subsequence of words without duplicate words.
 
Example 1:      [                         ]
Input: s = "the cat chased the mouse and the cat"
                 ^ 
                                          ^
Output: 5
Explanation: The longest substring without repeating words is "cat chased the mouse and"
 
set = set(the, cat, chased, the, mouse, and, the)

init l and r pointers, have set to keep track
move right pointer forward by 1, adding r to set
if r in set already, there's duplicate
move l pointer forward
remove l value from set
keep track of longest substring, keep updating longest substring
return that the very end

Example 2:
Input: s = "hello hello hello hello"
Output: 1
Explanation: The longest substring without repeating words is "hello".
"""

def longestSubsequence(s):
    s = s.split() # array of words O(n)
    l = 0
    res = 0
    seen = set()

    for r in range(len(s)):
        while s[r] in seen:
            seen.remove(s[l])
            l += 1
        res = max(res,(r - l + 1))
        seen.add(s[r])

    return res

set = ( cat, chased)
res = 3
"the cat chased the mouse and the cat"
    #   l
    #              r
print(longestSubsequence("the cat chased the mouse and the cat")) # 5
print(longestSubsequence("hello hello hello hello")) # 5
print(longestSubsequence("")) # 0
print(longestSubsequence("    ")) # 0