PGDMP  ;    5                }            eufTelegramBot    17.4    17.4 "    �           0    0    ENCODING    ENCODING        SET client_encoding = 'UTF8';
                           false            �           0    0 
   STDSTRINGS 
   STDSTRINGS     (   SET standard_conforming_strings = 'on';
                           false            �           0    0 
   SEARCHPATH 
   SEARCHPATH     8   SELECT pg_catalog.set_config('search_path', '', false);
                           false            �           1262    16388    eufTelegramBot    DATABASE     �   CREATE DATABASE "eufTelegramBot" WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'English_United States.1252';
     DROP DATABASE "eufTelegramBot";
                     postgres    false            �            1255    16734    update_updated_timestamp()    FUNCTION     �   CREATE FUNCTION public.update_updated_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;
 1   DROP FUNCTION public.update_updated_timestamp();
       public               postgres    false            �            1259    16686    ads    TABLE     M  CREATE TABLE public.ads (
    id character varying(255) NOT NULL,
    ad_name character varying(255),
    active_status boolean DEFAULT true,
    ad_image character varying(255),
    ad_text text,
    created timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
    DROP TABLE public.ads;
       public         heap r       postgres    false            �            1259    16677    destinations    TABLE       CREATE TABLE public.destinations (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    price numeric(10,2) NOT NULL,
    created timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
     DROP TABLE public.destinations;
       public         heap r       postgres    false            �            1259    16696    euf_transactions    TABLE     �  CREATE TABLE public.euf_transactions (
    id character varying(255) NOT NULL,
    telegram_id character varying(255) NOT NULL,
    destination character varying(255) NOT NULL,
    payment_confirmed boolean DEFAULT false,
    transaction_id character varying(255) NOT NULL,
    price numeric(10,2) NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    verification_count integer DEFAULT 0,
    created timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    paymongo_payment_id character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying
);
 $   DROP TABLE public.euf_transactions;
       public         heap r       postgres    false            �            1259    16715    payment_logs    TABLE       CREATE TABLE public.payment_logs (
    id character varying(255) NOT NULL,
    transaction_id character varying(255) NOT NULL,
    payment_status character varying(50) NOT NULL,
    payment_details jsonb,
    created timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
     DROP TABLE public.payment_logs;
       public         heap r       postgres    false            �            1259    16664    users    TABLE     �  CREATE TABLE public.users (
    id character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    token_key character varying(255) NOT NULL,
    email_visibility boolean DEFAULT false,
    verified boolean DEFAULT false,
    name character varying(255),
    avatar character varying(255),
    created timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
    DROP TABLE public.users;
       public         heap r       postgres    false            �          0    16686    ads 
   TABLE DATA           ^   COPY public.ads (id, ad_name, active_status, ad_image, ad_text, created, updated) FROM stdin;
    public               postgres    false    219   �.       �          0    16677    destinations 
   TABLE DATA           I   COPY public.destinations (id, name, price, created, updated) FROM stdin;
    public               postgres    false    218   �/       �          0    16696    euf_transactions 
   TABLE DATA           �   COPY public.euf_transactions (id, telegram_id, destination, payment_confirmed, transaction_id, price, "timestamp", verification_count, created, updated, paymongo_payment_id, status) FROM stdin;
    public               postgres    false    220   K0       �          0    16715    payment_logs 
   TABLE DATA           d   COPY public.payment_logs (id, transaction_id, payment_status, payment_details, created) FROM stdin;
    public               postgres    false    221   �5       �          0    16664    users 
   TABLE DATA           {   COPY public.users (id, email, password, token_key, email_visibility, verified, name, avatar, created, updated) FROM stdin;
    public               postgres    false    217   �5       J           2606    16695    ads ads_pkey 
   CONSTRAINT     J   ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (id);
 6   ALTER TABLE ONLY public.ads DROP CONSTRAINT ads_pkey;
       public                 postgres    false    219            H           2606    16685    destinations destinations_pkey 
   CONSTRAINT     \   ALTER TABLE ONLY public.destinations
    ADD CONSTRAINT destinations_pkey PRIMARY KEY (id);
 H   ALTER TABLE ONLY public.destinations DROP CONSTRAINT destinations_pkey;
       public                 postgres    false    218            M           2606    16707 &   euf_transactions euf_transactions_pkey 
   CONSTRAINT     d   ALTER TABLE ONLY public.euf_transactions
    ADD CONSTRAINT euf_transactions_pkey PRIMARY KEY (id);
 P   ALTER TABLE ONLY public.euf_transactions DROP CONSTRAINT euf_transactions_pkey;
       public                 postgres    false    220            O           2606    16709 4   euf_transactions euf_transactions_transaction_id_key 
   CONSTRAINT     y   ALTER TABLE ONLY public.euf_transactions
    ADD CONSTRAINT euf_transactions_transaction_id_key UNIQUE (transaction_id);
 ^   ALTER TABLE ONLY public.euf_transactions DROP CONSTRAINT euf_transactions_transaction_id_key;
       public                 postgres    false    220            T           2606    16722    payment_logs payment_logs_pkey 
   CONSTRAINT     \   ALTER TABLE ONLY public.payment_logs
    ADD CONSTRAINT payment_logs_pkey PRIMARY KEY (id);
 H   ALTER TABLE ONLY public.payment_logs DROP CONSTRAINT payment_logs_pkey;
       public                 postgres    false    221            D           2606    16676    users users_email_key 
   CONSTRAINT     Q   ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);
 ?   ALTER TABLE ONLY public.users DROP CONSTRAINT users_email_key;
       public                 postgres    false    217            F           2606    16674    users users_pkey 
   CONSTRAINT     N   ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
 :   ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
       public                 postgres    false    217            K           1259    16733    idx_ads_active_status    INDEX     N   CREATE INDEX idx_ads_active_status ON public.ads USING btree (active_status);
 )   DROP INDEX public.idx_ads_active_status;
       public                 postgres    false    219            P           1259    16732 &   idx_euf_transactions_payment_confirmed    INDEX     p   CREATE INDEX idx_euf_transactions_payment_confirmed ON public.euf_transactions USING btree (payment_confirmed);
 :   DROP INDEX public.idx_euf_transactions_payment_confirmed;
       public                 postgres    false    220            Q           1259    16730     idx_euf_transactions_telegram_id    INDEX     d   CREATE INDEX idx_euf_transactions_telegram_id ON public.euf_transactions USING btree (telegram_id);
 4   DROP INDEX public.idx_euf_transactions_telegram_id;
       public                 postgres    false    220            R           1259    16731 #   idx_euf_transactions_transaction_id    INDEX     j   CREATE INDEX idx_euf_transactions_transaction_id ON public.euf_transactions USING btree (transaction_id);
 7   DROP INDEX public.idx_euf_transactions_transaction_id;
       public                 postgres    false    220            A           1259    16728    idx_users_email    INDEX     B   CREATE INDEX idx_users_email ON public.users USING btree (email);
 #   DROP INDEX public.idx_users_email;
       public                 postgres    false    217            B           1259    16729    idx_users_token_key    INDEX     J   CREATE INDEX idx_users_token_key ON public.users USING btree (token_key);
 '   DROP INDEX public.idx_users_token_key;
       public                 postgres    false    217            Y           2620    16737    ads update_ads_updated    TRIGGER        CREATE TRIGGER update_ads_updated BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_timestamp();
 /   DROP TRIGGER update_ads_updated ON public.ads;
       public               postgres    false    222    219            X           2620    16736 (   destinations update_destinations_updated    TRIGGER     �   CREATE TRIGGER update_destinations_updated BEFORE UPDATE ON public.destinations FOR EACH ROW EXECUTE FUNCTION public.update_updated_timestamp();
 A   DROP TRIGGER update_destinations_updated ON public.destinations;
       public               postgres    false    222    218            Z           2620    16738 0   euf_transactions update_euf_transactions_updated    TRIGGER     �   CREATE TRIGGER update_euf_transactions_updated BEFORE UPDATE ON public.euf_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_timestamp();
 I   DROP TRIGGER update_euf_transactions_updated ON public.euf_transactions;
       public               postgres    false    220    222            W           2620    16735    users update_users_updated    TRIGGER     �   CREATE TRIGGER update_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_timestamp();
 3   DROP TRIGGER update_users_updated ON public.users;
       public               postgres    false    217    222            U           2606    16710 2   euf_transactions euf_transactions_telegram_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.euf_transactions
    ADD CONSTRAINT euf_transactions_telegram_id_fkey FOREIGN KEY (telegram_id) REFERENCES public.users(id);
 \   ALTER TABLE ONLY public.euf_transactions DROP CONSTRAINT euf_transactions_telegram_id_fkey;
       public               postgres    false    217    220    4678            V           2606    16723 -   payment_logs payment_logs_transaction_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.payment_logs
    ADD CONSTRAINT payment_logs_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.euf_transactions(transaction_id);
 W   ALTER TABLE ONLY public.payment_logs DROP CONSTRAINT payment_logs_transaction_id_fkey;
       public               postgres    false    4687    220    221            �   �   x��Ͽ
�0�9y��,����������jR,��\)}{SD�
7}���U&�:0�^	�I�l�4x�%l441���%R`0�n%�4߮�x%d�.-v�&��*��?�D����|���9��C��P�[��J�F���\+đXw_��8��6�����i�R'R���[�      �   �   x���A
�0����sC&i�ҥ�����n�6X!ZHS��Ap'Rtx�����c"8���q���)%���]�<��jejSH�*��//�e�B3���p��Մ�0�@�O[Î[�_ޭ����ZQM�,�/��v�!xl��@Ϯ����G~��C����NR��%]V      �   ~  x�}��N[IE�O��?�G]�U��~㎈�BᢑF}Bcg��~�M��%�oc�:����N����9���B���x��x�"�&`v�3^[mM���z?|���ݴkͩZ�\Ә\�ֲs>$2�����6���� `h��=��^*a��^�c�뤿�q�+�w��Kߊ��LI���S �
�k8��5�Vl��!4ۢ�D�@��0CK�6op,�����^qP%U�&���J�EA��5&��<�8�����f����v�-���mB$#Zi�a�V\n� �C��~a�(��o�xU2C=�1�t��w7�O�F��N����?�;h�
���bA��V�b��s��s��	�c�w�O�2q.@��}�2��k%�du�x����CCk{��
�{R3�L��6D��j�H��|5nۓ�ٟ]L����?���x���m-O��}��I9$R(n�h�(]��%G�`�e�v��H�N�{4-�cJ����Io01L�}��"����]�H-�?�&�������G����n�?�.~���(.�h�#I��T21�`r���
���M;��mJ\�U9WHN����"�E�w����3+�Z(�7�?�x �j7�G(9~8�m��Yq*R-WŁ�r\J�dc}i����Υ� jm�C2(�d38��W��99��=;�7�@��=�ή��N�^����6>9�������8���+\��桸E�'�s�25�L�u�L��l@��0�R�K�Z��+�Eޖ�Z<scW�O�#�ν�hH4Ծg=?U�t���5��8����h����(=��ޫ���0C�ʧ,����AĬ�� �or�w����!�<��ƾj�,����7�Q��$����s�إ���`mXe\Z﬘%��cw���>����Nw>~��X�-�L��j�'�\e��E`�g��EWB@iI�b9�X�3.Q���_V�ߢYq��� �+�K�s���M�߼W��p��~|��<��\!ĔCmR&^ΦP�S��U��@Yz�����N�?{�N��\@����Y\@�Yva���� `����TC�^��-\y��<�ƕ�{�:�5�vwc��p�������l��W���6N���)m���J(�v��G�&�Z@Ƕ�vJ�A{��e�e	F�F�&�,{�;y�k�o�B��uҒpcz��g����d�~>�?���çB�u�ƶ(�@^%vY� %����T�S�)�}dOr��\�����h�𶃈�%������߿�7���Iؚ|��rqx���VeS��!��\P�)+���6��:���#Y��e�R�H�F��������yW�f�Qn���|��-�ܪ�7�����ݹ��~8�_g��W��������Ç�|�I      �      x������ � �      �   �   x�}�A� E�p
/ ���U{����hjR�	��˦]6�/��#�����[��ϼ�^����K-�(��30��UG�z�f�P�J��~ۈ������.�Q���$�� �L��,�Gȁ������~�,`     