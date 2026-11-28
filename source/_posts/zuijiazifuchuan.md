---
title: 最佳字符串
date: 2019-07-26 20:56:18
tags:
 - OI
 - 字符串
categories:
 - OI
author: Doubleen
avatar: https://cdn.luogu.org/upload/usericon/56432.png
authorLink: https://doubleen233.github.io
authorAbout: 菜
authorDesc: 菜
description: 题解
photos: http://api.mtyqx.cn/api/random.php
---

## 题目描述

给定长度为N (1 ≤ N ≤ 500,000) 的字符串S, 要构造一个长度为N的字符串T. 反复进行如下任意操作:

从S的头部删除一个字符, 放入T的尾部;

从S的尾部删除一个字符, 放入T的尾部;

目标是要构造字典序尽可能小的字符串T.

## 输入

第1行：一个整数N，表示字符串长度

第2行..N+1行：每行一个字符，由大写字母组成（‘A’--‘Z’）

## 输出

输出最小字典序，由大写字母组成（‘A’--‘Z’），每行若满80个字符，换行输出

## 样例输入

6
A
C
D
B
C
B 

## 样例输出

ABCBCD 

## 提示

## 来源

[USACO07DEC](http://lzoi.win:8008/problemset.php?search=USACO07DEC)

## O(n^2)算法

对于这道题很容易想到贪心取头和尾的字符串，用一个双指针时间  

当头尾字符串相等时，暴力向前面扫，哪个字符串小就选哪边  

### 代码

```cpp
#include<cstdio>
const int M=500005;
char s[M],ans[M];
int tot,top;    
int n;
int main()
{
//  freopen("line.in","r",stdin);
//  freopen("line.out","w",stdout);
    scanf("%d",&n);
    for(register int i=1;i<=n;i++){
        char ch=getchar();
        while(ch=='\n'||ch==' ') ch=getchar();//读入特判回车
        s[i]=ch;
    }
    int l=1,r=n;
    while(tot<=n){
        if(s[l]<s[r]) ans[++tot]=s[l],l++;/左边的小，选左边，指针右移
        else if(s[l]>s[r]) ans[++tot]=s[r],r--;//右边的小，选右边，指针左移
        else{ //特殊处理相等情况
            if(l==r) ans[++tot]=s[l];//特判一下是否是只有一个了，那么就不用继续操作了
            else{
                int ll=l+1,rr=r-1; bool flg=false;
                while(ll<=rr) //用另一个指针比对第一个不同的字符在哪边
                    if(s[ll]<s[rr]){
                        flg=true;   break;
                    }
                    else if(s[ll]>s[rr]) break;
                    else ll++,rr--;
                if(flg) ans[++tot]=s[l++];//如果是左边小就选左边，否则右边
                else ans[++tot]=s[r--];
            }

        }
    }
    for(register int i=1;i<=n;i++){
        putchar(ans[i]);
        if(i%80==0) puts("");
    }
    return 0;
}
```

不过当数据是回文或者只有一个字符就会退化成n^2  

这题看到数据范围，虽然数据很水，但O(n^2)肯定过不了  

## 正解 O(n log n) 算法

对于正解，考虑字符串哈希。但是哈希我们只能对比出两个字符串的相等性，而且正确性与hash的模数息息相关  

那怎么办呢？  

可以在字符串hash值上二分，因为对于前面的解法，瓶颈就是在找到第一个不同的字符，我们只需找到第一个当前首尾不同的字符，而这就满足了单调性。  

我们举个例子：  

AAABGAAA  

对于这个字符串，他当前首尾的hash值肯定是“一样，一样，一样，不一样，不一样....”  

所以二分到“B,G" 这个点，比较即可  

hash O(n) 处理 O(1) 获取hash值  

完毕！！！！！！！！！  

优越性：正确性高，快速，可以代替后缀数组

不优越性：不能直接比较两个字符串的大小

#### 代码

```cpp
#include<cstdio>
typedef unsigned long long ll;
const int M=500005；
char s[M],ans[M];
ll hsh1[M],hsh2[M],pw[M]; //hash值用unsigned long long 可以自动取模 
int tot,top;    
int n;
bool check(int l,int r,int x,int y){
    ll a=hsh1[r]-hsh1[l-1]*pw[r-l+1],b=hsh2[x]-hsh2[y+1]*pw[y-x+1]; 
    //这一步相当于取出r~l/x~y的hash值 
    return a==b;
}
int find(int x,int y)
{
    int l=0,r=n-x,anss=0; //二分第一个不同的位置 
    while(l<=r){
        int mid=(l+r)>>1;
        if(check(x,x+mid,y-mid,y)) l=mid+1;//判断尾部和头部的字符串是否相等 
        else r=mid-1,anss=mid;
    }
    return anss;
}
int main()
{
    scanf("%d",&n); pw[0]=1;
    for(register int i=1;i<=n;i++){
        char ch=getchar();
        while(ch=='\n'||ch==' ') ch=getchar();
        s[i]=ch; hsh1[i]=hsh1[i-1]*27+s[i]-'A',pw[i]=pw[i-1]*27; //预处理出27的次方 
    }
    for(register int i=n;i>=1;i--) hsh2[i]=hsh2[i+1]*27+s[i]-'A';
    int l=1,r=n;
    while(tot<=n){
        int len=find(l,r);//二分 
        if(s[l+len]<s[r-len]) ans[++tot]=s[l++]; //和上面一样的双指针 
        else ans[++tot]=s[r--];
    }
    for(register int i=1;i<=n;i++){
        putchar(ans[i]);
        if(i%80==0) puts("");
    }
    return 0;
}
```
