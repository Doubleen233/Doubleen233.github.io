---
title: 旅行问题
date: 2020-07-25 22:56:13
tags: 
- dp
author: Doubleen
avatar: https://cdn.luogu.org/upload/usericon/56432.png
authorLink: https://doubleen233.github.io
authorAbout: 菜
authorDesc: 菜
description: Test
photos: http://api.mtyqx.cn/api/random.php
mathjax: true
---
# 旅行问题

## 题目大意

给出一个环，环上分别有$n$个元素$p$，$d$，令$a=p-d$，$sum$为$a$的前缀和，求是否有从点$i$顺时针/逆时针数$n$个数是否存在$sum_{j}-sum_{i-1}<0$

## 如何转换的？

环的话一般都是把它展开来，形成一个$2n$的链

我们求出$sum$数组时，普遍做法肯定是O(n)扫一遍求出是否有负数，所以优化的肯定是这个步骤。 

若一个位置上一个位置的前缀和大于这个位置及其后面$n$个位置中任意一个前缀和的话这个位置就不可行

那就转化为求是否有从点$i$顺时针/逆时针数$n$个数是否存在$sum_{j}-sum_{i-1}<0$

## 解法一

既然转化了题目，那题目也比较简单了，因为求的$n$个点必有最小值$k$，最小值中若$sum_k>sum_{i-1}$ 那肯定可行，反之亦然

那就放进一个堆中 求最小值 

或者也可以st表打起来 

$$O(n log n)$$

## 解法二

在连续$n$个元素中求最小值 就可以想到滑动的窗口 

$$O(n)$$

代码：

```cpp
#include<bits/stdc++.h>
using namespace std;
typedef long long ll;
const int N=1e6+5;
const int INF=0x3f3f3f3f;
int n;
ll s[N<<1];
bool ans[N];
int head,tail;
int p[N],d[N],a[N<<1],q[N];
int main() {
    scanf("%d",&n);
    for(register int i=1;i<=n;i++) scanf("%d%d",&p[i],&d[i]);
    d[0]=d[n];
    for(register int i=1;i<=n;i++) a[i]=a[n+i]=p[i]-d[i];
    for(register int i=1;i<n<<1;i++) s[i]=s[i-1]+a[i];
    head=1,tail=0;
    for(register int i=1;i<n*2;i++) {
        while(head<=tail&&i-n>=q[head]) ++head;
        while(head<=tail&&s[q[tail]]>=s[i]) --tail;
        q[++tail]=i;
        if(i>=n&&s[q[head]]>=s[i-n]) ans[i-n+1]=1;
    }
    for(register int i=1;i<=n;i++) a[i]=a[i+n]=p[n-i+1]-d[n-i];
    for(register int i=1;i<n*2;i++) s[i]=s[i-1]+a[i];
    head=1,tail=0;
    for(register int i=1;i<n<<1;i++) {
        while(head<=tail&&i-n>=q[head]) ++head;
        while(head<=tail&&s[q[tail]]>=s[i]) --tail;
        q[++tail]=i;
        if(i>=n&&s[q[head]]>=s[i-n]) ans[(n<<1)-i]=1;
    }
    for(register int i=1;i<=n;i++){
        if(ans[i]) puts("TAK");
        else puts("NIE");
    }
    return 0;
}
```













