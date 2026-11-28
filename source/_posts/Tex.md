---
title: 第二斯特林数入门
date: 2019-11-24 22:41:41

tags:

- 数论
- NTT

categories:

- OI
author: Doubleen
avatar: https://cdn.luogu.org/upload/usericon/56432.png
authorLink: https://doubleen233.github.io
authorAbout: 菜
authorDesc: 菜
description: Strling number
photos: http://api.mtyqx.cn/api/random.php
mathjax: true
---

# 第二斯特林数全想法集合

### 前言

今天心血来潮想搞搞这东东

### 正文

#### 1）第二类斯特林数？求法？

对于斯特林数，我们大部分都是这样理解的：

第二类$Stirling$数是**把包含n个元素的集合划分为正好k个非空子集的方法的数目**。

简单来看就是n个有区别小球，要放进m个相同盒子里，且每个盒子非空的方案数

这个应该很好理解，不过它有什么用呢

我们就来考虑这样一件事，假设我们有n−1个球丢进了m−1个组，因为每个组非空，所以这个球只有自己一组
如果前面的球已经分成了m组，那么，这个球就有m种放法

因此：

$S(n,m)=S(n-1,m-1)+m*S(n-1,m)$

当m>n时，S(n,m)=0

这就是第二类斯特林数的递推公式了，显然O(nm)

可是这可能会超时，那咋办呢

#### 2）容斥求第二类斯特林数

假设盒子有区别，并且我们允许空盒的存在  我们思考一下，发现$m^{n}$就是答案  
但是我们当然就是不允许空盒存在  
枚举我当前有几个空盒子存在，也就是C(m,k)  
然后剩下m−k个盒子，n个球可以随便放，也就是$(m−k)^{n}$  
又因为我们盒子是没有区别的，所以除以一个m!

$S(n,m)=\frac{1}{m!}\sum_{k=0}^{m}(-1)^kC(m,k)(m-k)^n$

求得

至于有组合意义方面的证明，看[https://www.cnblogs.com/gzy-cjoier/p/8426987.html](https://www.cnblogs.com/gzy-cjoier/p/8426987.html)

#### 3)神奇的事情

我们知道

$S(n,m)=\frac{1}{m!}\sum_{k=0}^{m}(-1)^kC(m,k)(m-k)^n$

$S(n,m)=\frac{1}{m!}\sum_{k=0}^{m}(-1)^k\frac{m!}{k!(m-k)!}(m-k)^n$

$S(n,m)=\sum_{k=0}^{m}\frac{(-1)^k}{k!}\frac{(m-k)^n}{(m-k)!}$

这不是卷积吗？

NTT解决O(n log n)

#### 4）反演

##### 公式

$q_n=\sum_{i=1}^{n}\begin{Bmatrix}n \\ i\end{Bmatrix}p_i \Leftrightarrow p_n=\sum_{i=0}^{n}(-1)^{n-i}\begin{bmatrix}n \\ i\end{bmatrix}q_i$

其中中括号括着的是第一类斯特林数

### 例题

Sum[ http://lzoi.win:8008/problem.php?id=3684](http://lzoi.win:8008/problem.php?id=3684)

对于这道题

要求

$\sum_{i=0}^{n}\sum_{j=0}^{i}S(i,j)2^{j}j!$

因为i<j时S(i,j)=0

所以

$\sum_{i=0}^{n}\sum_{j=0}^{n}S(i,j)2^{j}j!$

然后就可以将后面的只与j的东东提前了

$\sum_{j=0}^{n}2^{j}j!\sum_{i=0}^{n}S(i,j)$

再将我们之前推得的组合式子带回去

得

$\sum_{j=0}^{n}2^{j}j!\sum_{i=0}^{n}\sum_{k=0}^{j}​\frac{(-1)^{k}}{k!}\frac{(j-k)^{i}}{(i-k)!}$

$\sum_{j=0}^{n}2^{j}j!\sum_{k=0}^{j}\frac{(-1)^{k}}{k!}\frac{\sum_{i=0}^{n}(j-k)^{i}}{​(i-k)!}$

![klLSdsOoZzbmTKi](https://i.loli.net/2019/10/19/klLSdsOoZzbmTKi.png)

```cpp
#include<bits/stdc++.h>
using namespace std;
typedef long long ll;
const int M=3e5+5;
const ll p=998244353,G=3,Gi=332748118;
int n,len,lim=1;
ll f[M],g[M],inv[M],a[M],r[M];
ll take(ll a,ll b)
{
    ll s=1;
    while(b){
        if(b&1) s=(s*a)%p;
        a=(a*a)%p; b>>=1;
    }
    return s;
}//快速幂

void NTT(ll *a,int type)
{
    for(register int i=0;i<lim;i++){
        if(i<r[i]) swap(a[i],a[r[i]]);
    }
    for(register int mid=1;mid<lim;mid<<=1){
        ll wn=take((type==1?G:Gi),(p-1)/(mid<<1));
        for(register int j=0;j<lim;j+=(mid<<1)){
            ll w=1;
            for(register int k=0;k<mid;k++,w=w*wn%p){
                ll x=a[j+k],y=w*a[j+k+mid]%p;
                a[j+k]=(x+y)%p; a[j+k+mid]=((x-y)%p+p)%p;
            }
        }
    }
}///NTT

int main()
{
    int n;
    scanf("%d",&n);
    inv[1]=1; inv[0]=1; a[1]=1; a[0]=1;
    while(lim<=n<<1) lim<<=1,len++;
    for(register int i=2;i<=n;i++) a[i]=(a[i-1]*i)%p,inv[i]=take(a[i],p-2);//阶乘

    for(register int i=0;i<=n;i++) f[i]=((i&1)?-1:1)*inv[i]%p;//求a函数

    g[0]=1; g[1]=n+1;
    for(register int i=2;i<=n;i++) g[i]=(take(i,n+1)-1+p)%p*take(i-1,p-2)%p*inv[i]%p;//求b函数

    for(register int i=0;i<lim;i++) r[i]=(r[i>>1]>>1)|((i&1)<<(len-1));
    NTT(f,1); NTT(g,1);
    for(register int i=0;i<lim;i++) f[i]=f[i]*g[i]%p;
    NTT(f,-1);
    ll invv=take(lim,p-2);
    for(register int i=0;i<=n<<1;i++) f[i]=f[i]*invv%p;//NTT卷积

    ll ans=0;
    for(register int i=0;i<=n;i++){
        ans=(ans+take(2,i)*a[i]%p*f[i]%p)%p;
    }//求答案

    printf("%lld\n",ans);
    return 0;
}
```
