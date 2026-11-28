---
title: 斜率优化dp略解
date: 2019-03-20 22:41:41

tags:
 - dp
 - 斜率优化
categories:
 - OI
author: Doubleen
avatar: https://cdn.luogu.org/upload/usericon/56432.png
authorLink: https://doubleen233.github.io
authorAbout: 菜
authorDesc: 菜
description: 斜率优化
photos: http://api.mtyqx.cn/api/random.php
mathjax: true
---

### 斜率优化

模板题：luogu P3195

## 想法

普通dp方程：$dp[i]=min(dp[j]+(sum[i]-sum[j]+i-j-L-1)^2)$

我们惊奇的发现，这个dp式子是 $O(n^2)$ 的，那肯定会TLE，那怎么办呢？

**考虑斜率优化**

## 解法

设 $s[i]=$ 前缀和 $1~i$

设 $a[i]=s[i]+i$ $b[i]=s[i]+i+L+1$

$fuck$ 为斜率

原式化为：$dp[i]=dp[j]+(a[i]-b[j])^2$

经过推论和化简，很容易得到 $dp[i]=dp[j]+a[i]^2−2 \cdot a[i] \cdot b[j]+b[j]^2$

所以： $2 \cdot a[i]=\frac{dp[j]+b[j]^2+a[i]^2-dp[i]}{b[j]}$

**想法：单调队列维护凸包**

因为 $2 \cdot a[i]$ 是斜率，所以我们只要维护了 $2 \cdot a[i]$ 单调递增，就可以维护成下凸包。

表示存的可能为答案的点。因为我们要维护下凸包的性质，必须满足get(p[tail-1],p[tail])>get(p[tail],i)

我们根据斜率式子，队首必须满足get(p[head],p[head+1])<2A[i]

因为斜率越小越优，所以每次选队首。

大致可以有如下代码：

$$while(fuck(p_{head},p_{head+1})<2*a[i]) head++;$$

$$while(fuck(p_{tail},p_{head+1})<fuck(p_{tail-1},p_{tail})) head++;$$

所以代码如下：

```cpp
#include<cstdio>
#include<iostream>
#include<queue>
using namespace std;
const int M=50005;
double s[M],dp[M];
int q[M],n,L;
inline int read()
{
    int x=0; char ch=0;
    while(!isdigit(ch)) ch=getchar();
    while(isdigit(ch)) x=(x<<1)+(x<<3)+(ch^48),ch=getchar();
    return x;
}
double a(int i){return s[i]+i;}
double b(int i){return a(i)+1+L;}
double x(int i){return b(i);}
double y(int i){return dp[i]+b(i)*b(i);}
double fuck(int j,int k){return (y(j)-y(k))/(x(j)-x(k));}
int main()
{
    n=read(),L=read();
    for(register int i=1;i<=n;i++){
        scanf("%lf",&s[i]); s[i]+=s[i-1];
    }
    int head=1,tail=1;
    for(register int i=1;i<=n;i++){
        while(head<tail&&(fuck(q[head],q[head+1])<2.00*a(i))) head++;
        dp[i]=dp[q[head]]+(a(i)-b(q[head]))*(a(i)-b(q[head]));
        while(head<tail&&(fuck(q[tail],i)<fuck(q[tail-1],q[tail]))) tail--;
        q[++tail]=i;
    }
    printf("%lld\n",(long long)dp[n]);
    return 0;
}
```

## 总结

这道模板题只是斜率单调上升的情况，而其他不单调的解法更复杂，这里只略提一下，以后再细讲。

1.当斜率不单调无法pop队首时，就考虑二分或者三分查找队列中的最优解。

二分做法：假设你要在上凸包上二分找斜率为 $k$ 的切线。取中间的 $mid$ 号点，如果 $mid+1$ 存在且与 $mid$ 点的斜率小于 $k$ ，则 $l=mid+1$ ；如果 $mid−1$ 存在且与 $mid$ 点的斜率大于$k$，则 $r=mid−1$ ；如果上面两条都不满足，$mid$ 就是切点。

2.同时而如果 $b[j]$ 不单调(即横坐标不单调)怎么办呢？还能不能用斜率优化呢？

答案是可以的，我们需要使用CDQ分治或者splay来解决这个问题。

## 优秀的题目

1.luogu P3628 [APIO2010]特别行动队

2.luogu P3994 高速公路

3.bzoj1096[ZJOI2007]仓库建设

4.bzoj1597[USACP2008 Mar]土地购买

5.bzoj3156 防御准备

6.bzoj3675[Apio2014] 序列分割

7.bzoj3437 小P的牧场

8.bzoj4518[SDOI2016] 征途
