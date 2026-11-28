---
title: 饲料调配 Feed Ratios
date: 2019-07-26 21:03:59
tags:
 - 高斯消元
categories:
 - OI
author: Doubleen
avatar: https://cdn.luogu.com.cn/upload/usericon/56432.png
authorLink: https://doubleen233.github.io
authorAbout: 菜
authorDesc: 菜
description: 饲料调配
photos: http://api.mtyqx.cn/api/random.php
---

#### 前记：参考 [https://www.luogu.org/blog/Roy/2729tijie](https://www.luogu.org/blog/Roy/2729tijie)

## 题目描述

农夫约翰从来只用调配得最好的饲料来喂他的奶牛。饲料用三种原料调配成：大麦，燕麦和小麦。他知道自己的饲料精确的配比，在市场上是买不到这样的饲料的。他只好购买其他三种混合饲料（同样都由三种麦子组成），然后将它们混合，来调配他的完美饲料。

给出三组整数，表示 大麦：燕麦：小麦 的比例，找出用这三种饲料调配 x：y：z 的饲料的方法。

例如，给出目标饲料 3：4：5 和三种饲料的比例：

1:2:3 3:7:1 2:1:2 你必须编程找出使这三种饲料用量最少的方案，要是不能用这三种饲料调配目标饲料，输出“NONE”。“用量最少”意味着三种饲料的用量（整数）的和必须最小。

对于上面的例子，你可以用8份饲料1，1份饲料2，和5份饲料3，来得到7份目标饲料：

8*(1:2:3) + 1*(3:7:1) + 5*(2:1:2) = (21:28:35) = 7*(3:4:5)

表示饲料比例的整数以及目标饲料的都是小于100的非负整数。表示各种饲料的份数的整数，都小于100。一种混合物的比例不会由其他混合物的比例直接相加得到。

## 输入

Line 1: 三个用空格分开的整数，表示目标饲料

Line 2..4: 每行包括三个用空格分开的整数，表示农夫约翰买进的饲料的比例

## 输出

输出文件要包括一行，这一行要么有四个整数，要么是“NONE”。前三个整数表示三种饲料的份数，用这样的配比可以得到目标饲料。第四个整数表示混合三种饲料后得到的目标饲料的份数。

## 样例输入

3 4 5
1 2 3
3 7 1
2 1 2 

## 样例输出

8 1 5 7 

## 提示

所有数据在int范围

## 来源

[USACO](http://lzoi.win:8008/problemset.php?search=USACO) [Training](http://lzoi.win:8008/problemset.php?search=Training) [Section](http://lzoi.win:8008/problemset.php?search=Section) [3.2](http://lzoi.win:8008/problemset.php?search=3.2)

## 方法一：枚举

### 1.枚举

在看到题目后，很容易找到关键词--每个饲料都不超过100，也就是说，即使对于枚举三个饲料的大小也能拿到满分，时间复杂度O(n^3)  

### 2.特判0的情况

（1）暴力特判，将每一个饲料为0的全部枚举出来，大力if就好了  

（2）柯西不等式  
![](https://cdn.jsdelivr.net/gh/Doubleen233/CDN@2.0/img/Feed-Ratios/001.jpg)  

### 3.参考代码

```cpp
for(register int i=1;i<=300;i++)//枚举总数
        for(register int j=0;j<=i;j++)//枚举其中两个饲料
            for(register int k=0;k<=i-j;k++)
                {
                    int x=j*a[1][1].u+k*a[1][2].u+(i-j-k)*a[1][3].u;//算三个饲料的总数
                    int y=j*a[2][1].u+k*a[2][2].u+(i-j-k)*a[2][3].u;
                    int z=j*a[3][1].u+k*a[3][2].u+(i-j-k)*a[3][3].u;
                    if(x>=a[1][4].u&&y>=a[2][4].u&&z>=a[3][4].u/*判断一定是小于要求的答案，否则不成立*/&&a[1][4].u*y==a[2][4].u*x&&a[3][4].u*y==a[2][4].u*z){//大力if判断是否成立
                        printf("%d %d %d %d\n",j,k,i-j-k,x/a[1][4].u);
                        std::exit(0);//第一个找到的一定是最小的
                    }
                }
```

```cpp
#define squ(x) ((x)*(x))
if ((squ(a)+squ(b)+squ(c))*(squ(x)+squ(y)+squ(z))==squ(a*x+b*y+c*z)){
    //do something...
}//柯西不等式中n==3的特例
```

## 方法二：拓展->高斯消元

因为题目很容易转化成一个三元一次方程，高斯消元求一个解的lcm就好了

请移步[http://lzoi.win:8008/problem.php?id=3813](http://lzoi.win:8008/problem.php?id=3813) LZOJ3813

## 谢谢观看！
